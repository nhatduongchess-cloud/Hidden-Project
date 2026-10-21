"""One-process fleet service. SQLite persists dispatch and latest GPS; WebSocket sends snapshots."""
import asyncio
from contextlib import asynccontextmanager
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from .models import DispatchRequest, DriverAction, Position, OptimizeRequest
from .optimizer import optimize


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def create_app(db_path=None, admin_key=None, dev=None):
    folder = Path(os.environ.get('FLEET_DATA_DIR', 'server/data'))
    folder.mkdir(parents=True, exist_ok=True)
    key = admin_key or os.environ.get('FLEET_OPERATOR_KEY')
    development = dev if dev is not None else os.environ.get('FLEET_DEV') == '1'
    if not key:
        key_file = folder / 'operator.key'
        if not key_file.exists():
            key_file.write_text(secrets.token_urlsafe(32), encoding='utf8')
            key_file.chmod(0o600)
        key = key_file.read_text(encoding='utf8').strip()
    if len(key) < 24:
        raise RuntimeError('FLEET_OPERATOR_KEY must contain at least 24 characters.')
    db = sqlite3.connect(str(db_path or folder / 'fleet.sqlite3'), check_same_thread=False)
    db.execute('CREATE TABLE IF NOT EXISTS fleet (id INTEGER PRIMARY KEY, body TEXT NOT NULL)')
    row = db.execute('SELECT body FROM fleet WHERE id=1').fetchone()
    state = json.loads(row[0]) if row else {'revision': 0, 'plan': None, 'positions': {}, 'tokens': {}}
    # Live tracking cannot be assumed after a service restart.
    for p in state['positions'].values():
        p['tracking'] = False
    pending = {}
    listeners: set[asyncio.Queue] = set()
    solving = asyncio.Lock()

    @asynccontextmanager
    async def lifespan(_):
        yield
        db.close()

    app = FastAPI(title='RE Fleet', lifespan=lifespan, docs_url=None, redoc_url=None)

    def snapshot():
        return {'revision': state['revision'], 'plan': state['plan'],
                'positions': state['positions'], 'serverTime': time.time() * 1000}

    def save():
        state['revision'] += 1
        db.execute('INSERT OR REPLACE INTO fleet VALUES (1, ?)', (json.dumps(state),))
        db.commit()
        payload = json.dumps(snapshot())
        for queue in listeners:
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(payload)

    async def operator(authorization: str = Header(default='')):
        if not hmac.compare_digest(digest(authorization), digest('Bearer ' + key)):
            raise HTTPException(401, 'Khóa điều phối không hợp lệ.')

    async def driver(authorization: str = Header(default='')):
        token = authorization.removeprefix('Bearer ')
        entry = state['tokens'].get(digest(token))
        if not entry or entry['expiresAt'] < time.time() or not state['plan']:
            raise HTTPException(401, 'Liên kết tài xế đã hết hạn hoặc bị thu hồi.')
        route = next((r for r in state['plan']['routes'] if r['vehicle']['id'] == entry['vehicleId']), None)
        if not route:
            raise HTTPException(401, 'Xe không còn trong kế hoạch.')
        return route

    @app.middleware('http')
    async def security_headers(request, call_next):
        # The API is same-origin. In development Vite proxies /api; no wildcard CORS.
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.get('/api/health')
    def health():
        return {'ok': True, 'optimizer': 'OR-Tools'}

    @app.post('/api/dev-session')
    async def dev_session(request: Request):
        # Explicit local-only convenience. Disabled by default; never trust forwarded clients.
        origin = urlparse(request.headers.get('origin', ''))
        local = {'localhost', '127.0.0.1', '::1'}
        if (not development or not request.client or request.client.host not in local
                or request.url.hostname not in local or origin.hostname not in local
                or request.headers.get('x-forwarded-for') or request.headers.get('forwarded')):
            raise HTTPException(403, 'Nhập khóa điều phối để kết nối.')
        return {'key': key}

    @app.get('/api/fleet', dependencies=[Depends(operator)])
    async def fleet():
        return snapshot()

    @app.post('/api/optimize', dependencies=[Depends(operator)])
    async def plan(body: OptimizeRequest):
        if solving.locked():
            raise HTTPException(429, 'Đang tính một phương án khác. Thử lại sau vài giây.')
        async with solving:
            result = await run_in_threadpool(optimize, body)
        if result['feasible']:
            plan_id = secrets.token_urlsafe(18)
            now = time.time()
            for old in list(pending):
                if pending[old]['expires'] < now:
                    del pending[old]
            if len(pending) >= 20:
                del pending[next(iter(pending))]
            pending[plan_id] = {'result': result, 'expires': now + 900}
            return {**result, 'planId': plan_id}
        return result

    @app.post('/api/dispatch', dependencies=[Depends(operator)])
    async def dispatch(body: DispatchRequest):
        if state['revision'] != body.revision:
            raise HTTPException(409, 'Dữ liệu đã thay đổi. Tải lại trước khi giao tuyến.')
        if state['plan'] and any(r['status'] != 'done' for r in state['plan']['routes']):
            raise HTTPException(409, 'Còn chuyến đang hoạt động. Kết thúc đợt điều phối trước.')
        candidate = pending.get(body.planId)
        if not candidate or candidate['expires'] < time.time():
            raise HTTPException(409, 'Phương án hết hạn. Hãy tính lại tuyến.')
        result = candidate['result']
        if result['provider'] == 'estimate' or not result['routes']:
            raise HTTPException(422, 'Cần dữ liệu đường thực và ít nhất một điểm thu gom để giao tuyến.')
        state['plan'] = {**result, 'id': body.planId, 'createdAt': time.time() * 1000}
        state['positions'], state['tokens'] = {}, {}
        links = []
        for route in result['routes']:
            token = secrets.token_urlsafe(32)
            vehicle_id = route['vehicle']['id']
            state['tokens'][digest(token)] = {'vehicleId': vehicle_id, 'expiresAt': time.time() + 86400}
            links.append({'vehicleId': vehicle_id, 'token': token})
        del pending[body.planId]
        save()
        return {'fleet': snapshot(), 'links': links}

    @app.post('/api/fleet/end', dependencies=[Depends(operator)])
    async def end():
        if state['plan']:
            for route in state['plan']['routes']:
                route['status'] = 'done'
        state['tokens'] = {}
        # End sharing and remove precise positions; no location history is kept.
        state['positions'] = {}
        save()
        return snapshot()

    @app.post('/api/vehicles/{vehicle_id}/link', dependencies=[Depends(operator)])
    async def renew_link(vehicle_id: str):
        if not state['plan'] or not any(r['vehicle']['id'] == vehicle_id and r['status'] != 'done' for r in state['plan']['routes']):
            raise HTTPException(404, 'Không có chuyến đang hoạt động cho xe này.')
        state['tokens'] = {k: v for k, v in state['tokens'].items() if v['vehicleId'] != vehicle_id}
        token = secrets.token_urlsafe(32)
        state['tokens'][digest(token)] = {'vehicleId': vehicle_id, 'expiresAt': time.time() + 86400}
        state['positions'].pop(vehicle_id, None)
        save()
        return {'vehicleId': vehicle_id, 'token': token}

    @app.get('/api/driver')
    async def driver_route(route=Depends(driver)):
        return {'route': route, 'depot': state['plan']['depot'], 'destination': state['plan']['destination'],
                'position': state['positions'].get(route['vehicle']['id']), 'serverTime': time.time() * 1000}

    @app.post('/api/driver/position')
    async def position(body: Position, route=Depends(driver)):
        if route['status'] == 'done':
            raise HTTPException(409, 'Chuyến đã kết thúc.')
        now = time.time() * 1000
        if body.recordedAt < now - 120000 or body.recordedAt > now + 30000:
            raise HTTPException(422, 'Thời gian GPS không hợp lệ. Kiểm tra đồng hồ thiết bị.')
        vehicle_id = route['vehicle']['id']
        previous = state['positions'].get(vehicle_id)
        if previous and body.recordedAt <= previous['recordedAt']:
            raise HTTPException(409, 'Đã nhận một vị trí mới hơn.')
        state['positions'][vehicle_id] = {**body.model_dump(), 'receivedAt': now, 'tracking': True}
        save()
        return {'receivedAt': now}

    @app.post('/api/driver/action')
    async def action(body: DriverAction, route=Depends(driver)):
        vehicle_id = route['vehicle']['id']
        if route['status'] == 'done':
            raise HTTPException(409, 'Chuyến đã kết thúc.')
        if body.action == 'collected':
            stop = next((s for s in route['stops'] if s['id'] == body.stationId), None)
            if not stop:
                raise HTTPException(404, 'Trạm không thuộc tuyến xe này.')
            stop['status'] = 'done'
            stop['doneAt'] = time.time() * 1000
            route['status'] = 'in_progress'
        elif body.action == 'start':
            route['status'] = 'in_progress'
        elif body.action == 'finish':
            if any(s['status'] != 'done' for s in route['stops']):
                raise HTTPException(409, 'Hãy xác nhận các điểm đã thu gom trước khi kết thúc.')
            route['status'] = 'done'
            state['positions'].pop(vehicle_id, None)
        elif body.action == 'stop':
            if vehicle_id in state['positions']:
                state['positions'][vehicle_id]['tracking'] = False
        save()
        return {'ok': True}

    @app.websocket('/api/live')
    async def live(ws: WebSocket):
        await ws.accept()
        queue = asyncio.Queue(maxsize=1)
        try:
            auth = await asyncio.wait_for(ws.receive_json(), 5)
            if not isinstance(auth, dict) or not hmac.compare_digest(digest(str(auth.get('key', ''))), digest(key)):
                await ws.close(code=4401)
                return
            listeners.add(queue)
            await ws.send_json(snapshot())
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), 15)
                except asyncio.TimeoutError:
                    payload = json.dumps(snapshot())
                await asyncio.wait_for(ws.send_text(payload), 5)
        except (WebSocketDisconnect, asyncio.TimeoutError, RuntimeError, ValueError):
            pass
        finally:
            listeners.discard(queue)
            try:
                await ws.close()
            except RuntimeError:
                pass

    static_dir = os.environ.get('FLEET_STATIC_DIR')
    if static_dir:
        app.mount('/', StaticFiles(directory=static_dir, html=True), name='frontend')
    return app
