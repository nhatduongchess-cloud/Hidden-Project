"""RE Rewards API. Persistent accounts, server-owned points and atomic redemption."""
from contextlib import contextmanager
import hashlib
import hmac
import os
from pathlib import Path
import re
import secrets
import sqlite3
import threading
import time

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ConfigDict


class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class Login(Input):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=12, max_length=128)


class Register(Login):
    name: str = Field(min_length=2, max_length=70)


class Profile(Input):
    name: str = Field(min_length=2, max_length=70)
    phone: str = Field(default='', max_length=20, pattern=r'^[+\d ()-]*$')


class Redeem(Input):
    reward_id: str = Field(min_length=1, max_length=80)
    request_id: str = Field(min_length=16, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')


class Credit(Input):
    user_id: str = Field(min_length=1, max_length=80)
    reference: str = Field(min_length=3, max_length=120)
    points: int = Field(strict=True, gt=0, le=100000)
    description: str = Field(min_length=3, max_length=160)


class Password(Input):
    password: str = Field(min_length=12, max_length=128)


class ChangePassword(Password):
    new_password: str = Field(min_length=12, max_length=128)


class RewardInput(Input):
    id: str = Field(min_length=1, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    brand: str = Field(min_length=2, max_length=60)
    title: str = Field(min_length=3, max_length=100)
    category: str = Field(pattern=r'^(food|shopping|lifestyle)$')
    points: int = Field(strict=True, gt=0, le=1000000)
    stock: int = Field(strict=True, ge=0, le=1000000)
    description: str = Field(min_length=5, max_length=800)
    terms: str = Field(min_length=5, max_length=1200)
    art: str = Field(pattern=r'^(coffee|bag|bottle|meal|book|plant)$')
    color: str = Field(pattern=r'^#[0-9a-fA-F]{6}$')
    sample: bool = True
    active: bool = True


SAMPLES = [
    ('coffee-01', 'Mộc Coffee', 'Một ly cà phê, một ngày xanh', 'food', 450, 120, 'coffee', '#F2DDC8', 'Voucher 35.000đ cho đồ uống bạn yêu thích.'),
    ('bag-01', 'Lá Studio', 'Túi tote mang cả thế giới', 'lifestyle', 800, 35, 'bag', '#DBEAD6', 'Túi vải cotton tái sử dụng, nhẹ và bền cho mỗi ngày.'),
    ('meal-01', 'Bếp Lành', 'Bữa trưa ngon & lành', 'food', 650, 70, 'meal', '#FAE5BA', 'Ưu đãi 50.000đ cho một bữa ăn đủ đầy.'),
    ('bottle-01', 'Loop Living', 'Bình nước đồng hành', 'lifestyle', 1400, 24, 'bottle', '#DCE9F0', 'Bình giữ nhiệt 500 ml cho những chuyến đi của bạn.'),
    ('book-01', 'Trạm Sách', 'Thêm một cuốn sách hay', 'shopping', 1000, 55, 'book', '#E7E0F2', 'Voucher 70.000đ để chọn cuốn sách tiếp theo.'),
    ('plant-01', 'Vườn Nhỏ', 'Một góc xanh trên bàn', 'lifestyle', 900, 18, 'plant', '#E4EBC8', 'Chậu cây để bàn cùng hướng dẫn chăm sóc.')
]


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    value = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return salt + ':' + value


def matches(password, stored):
    return hmac.compare_digest(password_hash(password, stored.split(':')[0]), stored)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def create_app(db_path=None, admin_key=None, sample=None):
    folder = Path(os.getenv('REWARDS_DATA_DIR', 'server/data/rewards'))
    folder.mkdir(parents=True, exist_ok=True)
    path = str(db_path or folder / 'rewards.sqlite3')
    sample = sample if sample is not None else os.getenv('REWARDS_SAMPLE_DATA', '1') == '1'
    key = admin_key or os.getenv('REWARDS_OPERATOR_KEY')
    if not key:
        key_file = folder / 'operator.key'
        if not key_file.exists():
            key_file.write_text(secrets.token_urlsafe(32), encoding='utf8')
            key_file.chmod(0o600)
        key = key_file.read_text().strip()
    if len(key) < 24:
        raise RuntimeError('REWARDS_OPERATOR_KEY must contain at least 24 characters')

    @contextmanager
    def database():
        db = sqlite3.connect(path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    with database() as db:
        db.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', password TEXT NOT NULL, created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS rewards (id TEXT PRIMARY KEY, brand TEXT NOT NULL, title TEXT NOT NULL,
          category TEXT NOT NULL, points INTEGER NOT NULL CHECK(points>0), stock INTEGER NOT NULL CHECK(stock>=0),
          description TEXT NOT NULL, terms TEXT NOT NULL, art TEXT NOT NULL, color TEXT NOT NULL, sample INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          delta INTEGER NOT NULL, description TEXT NOT NULL, reference TEXT UNIQUE NOT NULL, created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS redemptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          reward_id TEXT NOT NULL REFERENCES rewards(id), request_id TEXT NOT NULL, code TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL, brand TEXT NOT NULL, points INTEGER NOT NULL, art TEXT NOT NULL, color TEXT NOT NULL,
          terms TEXT NOT NULL, sample INTEGER NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, used INTEGER,
          UNIQUE(user_id,request_id));
        CREATE INDEX IF NOT EXISTS ledger_user ON ledger(user_id,created);
        CREATE INDEX IF NOT EXISTS redemption_user ON redemptions(user_id,created);
        ''')
        if sample:
            for rid, brand, title, cat, points, stock, art, color, desc in SAMPLES:
                db.execute('INSERT OR IGNORE INTO rewards VALUES (?,?,?,?,?,?,?,?,?,?,1,1)',
                           (rid, brand, title, cat, points, stock, desc,
                            'Quà và nhãn hàng thuộc danh mục mẫu, không có giá trị thanh toán. Mã có hạn 30 ngày và dùng một lần.', art, color))

    app = FastAPI(title='RE Rewards', docs_url=None, redoc_url=None)
    origins = [x.strip() for x in os.getenv('REWARDS_ALLOWED_ORIGINS', 'http://localhost:8081,http://127.0.0.1:8081').split(',') if x.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=['GET','POST','PATCH','DELETE'], allow_headers=['Authorization','Content-Type'])
    attempts, guard = {}, threading.Lock()
    dummy = password_hash('unused-timing-comparison-password')

    @app.middleware('http')
    async def security(request: Request, call_next):
        from fastapi.responses import JSONResponse
        try:
            size = int(request.headers.get('content-length', '0'))
        except ValueError:
            return JSONResponse({'detail': 'Yêu cầu không hợp lệ.'}, status_code=400)
        if size < 0:
            return JSONResponse({'detail': 'Yêu cầu không hợp lệ.'}, status_code=400)
        if size > 32768:
            return JSONResponse({'detail': 'Yêu cầu quá lớn.'}, status_code=413)
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        return response

    def throttle(request: Request):
        host, now = request.client.host if request.client else 'unknown', time.time()
        with guard:
            for k in list(attempts):
                if now - attempts[k][0] > 60:
                    del attempts[k]
            start, count = attempts.get(host, (now, 0))
            if count >= 20:
                raise HTTPException(429, 'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.')
            attempts[host] = (start, count + 1)

    def email_address(value):
        value = value.strip().lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
            raise HTTPException(422, 'Vui lòng nhập email hợp lệ.')
        return value

    def member(authorization: str = Header(default='')):
        with database() as db:
            row = db.execute('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',
                             (digest(authorization.removeprefix('Bearer ')), int(time.time()))).fetchone()
        if not row:
            raise HTTPException(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
        return dict(row)

    def operator(authorization: str = Header(default='')):
        if not hmac.compare_digest(digest(authorization), digest('Bearer ' + key)):
            raise HTTPException(401, 'Không có quyền thực hiện thao tác này.')

    def balance(db, uid):
        return db.execute('SELECT COALESCE(SUM(delta),0) FROM ledger WHERE user_id=?', (uid,)).fetchone()[0]

    def issue_session(db, uid):
        token = secrets.token_urlsafe(32)
        db.execute('DELETE FROM sessions WHERE expires<=?', (int(time.time()),))
        db.execute('INSERT INTO sessions VALUES (?,?,?)', (digest(token), uid, int(time.time()) + 30*86400))
        return {'token': token}

    def gift(row):
        out = dict(row)
        out.pop('user_id', None)
        out.pop('request_id', None)
        out['status'] = 'used' if out['used'] else 'expired' if out['expires'] <= time.time() else 'available'
        return out

    @app.get('/api/rewards/health')
    def health():
        return {'ok': True, 'sample': sample}

    @app.post('/api/rewards/auth/register', dependencies=[Depends(throttle)], status_code=201)
    def register(body: Register):
        email = email_address(body.email)
        encoded, uid, now = password_hash(body.password), secrets.token_hex(12), int(time.time())
        with database() as db:
            try:
                db.execute('INSERT INTO users(id,email,name,password,created) VALUES (?,?,?,?,?)', (uid,email,body.name,encoded,now))
            except sqlite3.IntegrityError:
                raise HTTPException(409, 'Email đã được đăng ký. Vui lòng đăng nhập.')
            if sample:
                db.execute('INSERT INTO ledger VALUES (?,?,?,?,?,?)', (secrets.token_hex(12),uid,1250,'Điểm mẫu ban đầu','welcome:'+uid,now))
            return issue_session(db, uid)

    @app.post('/api/rewards/auth/login', dependencies=[Depends(throttle)])
    def login(body: Login):
        email = email_address(body.email)
        with database() as db:
            row = db.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
            valid = matches(body.password, row['password'] if row else dummy)
            if not row or not valid:
                raise HTTPException(401, 'Email hoặc mật khẩu chưa đúng.')
            return issue_session(db, row['id'])

    @app.post('/api/rewards/auth/logout')
    def logout(authorization: str = Header(default='')):
        with database() as db:
            db.execute('DELETE FROM sessions WHERE token=?', (digest(authorization.removeprefix('Bearer ')),))
        return {'ok': True}

    @app.get('/api/rewards/me')
    def me(user=Depends(member)):
        with database() as db:
            return {'id':user['id'], 'name':user['name'], 'email':user['email'], 'phone':user['phone'],
                    'points':balance(db,user['id']), 'sample':sample,
                    'earned':db.execute('SELECT COALESCE(SUM(delta),0) FROM ledger WHERE user_id=? AND delta>0',(user['id'],)).fetchone()[0]}

    @app.patch('/api/rewards/me')
    def update_profile(body: Profile, user=Depends(member)):
        with database() as db:
            db.execute('UPDATE users SET name=?,phone=? WHERE id=?', (body.name,body.phone,user['id']))
        return {'ok':True}

    @app.post('/api/rewards/me/password', dependencies=[Depends(throttle)])
    def change_password(body: ChangePassword, user=Depends(member)):
        if not matches(body.password,user['password']):
            raise HTTPException(400,'Mật khẩu hiện tại chưa đúng.')
        with database() as db:
            db.execute('UPDATE users SET password=? WHERE id=?', (password_hash(body.new_password),user['id']))
            db.execute('DELETE FROM sessions WHERE user_id=?',(user['id'],))
        return {'ok':True}

    @app.delete('/api/rewards/me', dependencies=[Depends(throttle)])
    def delete_account(body: Password, user=Depends(member)):
        if not matches(body.password,user['password']):
            raise HTTPException(400,'Mật khẩu chưa đúng.')
        with database() as db:
            db.execute('DELETE FROM users WHERE id=?',(user['id'],))
        return {'ok':True}

    @app.get('/api/rewards/catalog')
    def catalog():
        with database() as db:
            return {'items':[dict(x) for x in db.execute('SELECT * FROM rewards WHERE active=1 ORDER BY points')], 'sample':sample}

    @app.get('/api/rewards/ledger')
    def ledger(user=Depends(member)):
        with database() as db:
            return [dict(x) for x in db.execute('SELECT id,delta,description,created FROM ledger WHERE user_id=? ORDER BY created DESC,rowid DESC LIMIT 200',(user['id'],))]

    @app.get('/api/rewards/wallet')
    def wallet(user=Depends(member)):
        with database() as db:
            return [gift(x) for x in db.execute('SELECT * FROM redemptions WHERE user_id=? ORDER BY created DESC,rowid DESC',(user['id'],))]

    @app.post('/api/rewards/redeem')
    def redeem(body: Redeem, user=Depends(member)):
        with database() as db:
            db.execute('BEGIN IMMEDIATE')
            existing = db.execute('SELECT * FROM redemptions WHERE user_id=? AND request_id=?',(user['id'],body.request_id)).fetchone()
            if existing:
                if existing['reward_id'] != body.reward_id:
                    raise HTTPException(409,'Yêu cầu đã được dùng cho quà khác.')
                return gift(existing)
            r = db.execute('SELECT * FROM rewards WHERE id=? AND active=1',(body.reward_id,)).fetchone()
            if not r or r['stock'] <= 0:
                raise HTTPException(409,'Quà đã hết. Bạn hãy chọn một phần quà khác.')
            if balance(db,user['id']) < r['points']:
                raise HTTPException(409,'Bạn chưa đủ điểm để đổi quà này.')
            rid, now = secrets.token_hex(12), int(time.time())
            db.execute('UPDATE rewards SET stock=stock-1 WHERE id=?',(r['id'],))
            db.execute('INSERT INTO ledger VALUES (?,?,?,?,?,?)',(secrets.token_hex(12),user['id'],-r['points'],'Đổi quà: '+r['title'],'redeem:'+rid,now))
            db.execute('INSERT INTO redemptions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)',
                       (rid,user['id'],r['id'],body.request_id,'RE-'+secrets.token_hex(6).upper(),r['title'],r['brand'],r['points'],r['art'],r['color'],r['terms'],r['sample'],now,now+30*86400))
            return gift(db.execute('SELECT * FROM redemptions WHERE id=?',(rid,)).fetchone())

    @app.post('/api/rewards/operator/credit', dependencies=[Depends(operator)])
    def credit(body: Credit):
        with database() as db:
            db.execute('BEGIN IMMEDIATE')
            if not db.execute('SELECT id FROM users WHERE id=?',(body.user_id,)).fetchone():
                raise HTTPException(404,'Không tìm thấy tài khoản.')
            ref = 'credit:'+body.reference
            old = db.execute('SELECT * FROM ledger WHERE reference=?',(ref,)).fetchone()
            if old and (old['user_id'] != body.user_id or old['delta'] != body.points):
                raise HTTPException(409,'Mã giao dịch đã được dùng.')
            if not old:
                db.execute('INSERT INTO ledger VALUES (?,?,?,?,?,?)',(secrets.token_hex(12),body.user_id,body.points,body.description,ref,int(time.time())))
            return {'points':balance(db,body.user_id)}

    @app.post('/api/rewards/operator/catalog', dependencies=[Depends(operator)])
    def put_reward(body: RewardInput):
        with database() as db:
            values = body.model_dump()
            columns = list(values)
            db.execute(f'INSERT INTO rewards ({",".join(columns)}) VALUES ({",".join("?" for _ in columns)}) ON CONFLICT(id) DO UPDATE SET '+','.join(f'{c}=excluded.{c}' for c in columns if c!='id'),list(values.values()))
        return {'ok':True}

    @app.post('/api/rewards/operator/use/{code}', dependencies=[Depends(operator)])
    def use_gift(code: str):
        with database() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM redemptions WHERE code=?',(code,)).fetchone()
            if not row or row['used'] or row['expires'] <= time.time():
                raise HTTPException(409,'Mã không hợp lệ, đã dùng hoặc đã hết hạn.')
            db.execute('UPDATE redemptions SET used=? WHERE id=?',(int(time.time()),row['id']))
        return {'ok':True}

    static_dir = os.getenv('REWARDS_STATIC_DIR')
    if static_dir:
        app.mount('/',StaticFiles(directory=static_dir,html=True),name='rewards-app')
    return app
