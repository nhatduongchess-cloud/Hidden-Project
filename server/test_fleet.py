import time
import pytest
from fastapi.testclient import TestClient
from .app import create_app
from .models import OptimizeRequest
from .optimizer import optimize

KEY = 'test-operator-key-with-32-characters'
AUTH = {'Authorization': f'Bearer {KEY}'}


def request():
    return {'vehicles': [{'id': f'XE-0{i}', 'driver': f'Driver {i}', 'payloadKg': 100,
                          'volumeM3': 1, 'start': 480, 'end': 1020} for i in (1, 2)],
            'stations': [{'id': f'RE-00{i}', 'name': f'Station {i}', 'lat': 10.8, 'lng': 106.6,
                          'massKg': 70, 'volumeM3': .6, 'fillPct': 95 if i == 1 else 85,
                          'forecastPct': 95, 'open': 480, 'close': 1020} for i in (1, 2)],
            'depot': {'name': 'Depot', 'lat': 10.7, 'lng': 106.6},
            'destination': {'name': 'Container', 'lat': 10.9, 'lng': 106.6},
            'distancesM': [[0 if i == j else 1000 for j in range(4)] for i in range(4)],
            'durationsS': [[0 if i == j else 600 for j in range(4)] for i in range(4)],
            'provider': 'valhalla'}


def solve(body):
    return optimize(OptimizeRequest.model_validate(body), seconds=1)


def test_two_trucks_are_required_and_stops_unique():
    body = request()
    result = solve(body)
    assert result['feasible']
    assert len(result['routes']) == 2
    assert sorted(s['id'] for r in result['routes'] for s in r['stops']) == ['RE-001', 'RE-002']
    assert all(r['loadKg'] <= 100 and r['volumeM3'] <= 1 and r['endMin'] <= 1020 for r in result['routes'])
    body['vehicles'] = body['vehicles'][:1]
    assert not solve(body)['feasible']


def test_volume_windows_unreachable_and_service_duration():
    body = request()
    for vehicle in body['vehicles']:
        vehicle['volumeM3'] = .5
    assert not solve(body)['feasible']
    body = request()
    body['stations'][0]['close'] = 495
    assert not solve(body)['feasible']  # arrival 490 + 8 minutes exceeds close
    body = request()
    for i in range(4):
        if i != 1:
            body['durationsS'][i][1] = None
    assert not solve(body)['feasible']


def test_ban_waiting_and_final_leg():
    body = request()
    body['drivingBans'] = [{'start': 480, 'end': 540}, {'start': 555, 'end': 600}]
    result = solve(body)
    assert result['feasible']
    for route in result['routes']:
        assert route['stops'][0]['etaMin'] >= 550
        assert route['endMin'] >= 610


def test_optional_dropped_and_forecast_mandatory():
    body = request()
    body['stations'][1].update(fillPct=55, forecastPct=60)
    body['vehicles'] = body['vehicles'][:1]
    result = solve(body)
    assert result['feasible'] and result['unserved'] == ['RE-002']
    body['stations'][1]['forecastPct'] = 80
    assert not solve(body)['feasible']


def test_unused_truck_does_not_need_to_drive_to_destination():
    body = request()
    body['vehicles'].append({**body['vehicles'][0], 'id': 'SPARE', 'start': 480, 'end': 481})
    result = solve(body)
    assert result['feasible'] and len(result['routes']) == 2
    assert all(r['vehicle']['id'] != 'SPARE' for r in result['routes'])


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('FLEET_DATA_DIR', str(tmp_path))
    with TestClient(create_app(tmp_path / 'test.sqlite', KEY, dev=False)) as c:
        yield c


def dispatch(client):
    planned = client.post('/api/optimize', headers=AUTH, json=request())
    assert planned.status_code == 200, planned.text
    result = planned.json()
    res = client.post('/api/dispatch', headers=AUTH, json={'planId': result['planId'], 'revision': client.get('/api/fleet', headers=AUTH).json()['revision']})
    assert res.status_code == 200, res.text
    return res.json()


def test_auth_validation_and_dev_disabled(client):
    assert client.get('/api/fleet').status_code == 401
    assert client.post('/api/dev-session', headers={'Origin': 'http://localhost:5173'}).status_code == 403
    bad = request(); bad['vehicles'][0]['payloadKg'] = 1001
    assert client.post('/api/optimize', headers=AUTH, json=bad).status_code == 422
    bad = request(); bad['distancesM'][0] = [0]
    assert client.post('/api/optimize', headers=AUTH, json=bad).status_code == 422
    with client.websocket_connect('/api/live') as ws:
        ws.send_json({'key': 'wrong'})
        assert ws.receive()['code'] == 4401


def test_dispatch_gps_broadcast_auth_order_and_revocation(client):
    dispatched = dispatch(client)
    vehicle = dispatched['links'][0]['vehicleId']
    driver_auth = {'Authorization': 'Bearer ' + dispatched['links'][0]['token']}
    second_auth = {'Authorization': 'Bearer ' + dispatched['links'][1]['token']}
    assert client.get('/api/fleet', headers=driver_auth).status_code == 401
    with client.websocket_connect('/api/live') as ws:
        ws.send_json({'key': KEY})
        initial = ws.receive_json()
        assert 'tokens' not in initial
        fix = {'lat': 10.8, 'lng': 106.7, 'accuracy': 12, 'recordedAt': time.time() * 1000}
        assert client.post('/api/driver/position', headers=driver_auth, json=fix).status_code == 200
        live = ws.receive_json()
        assert live['positions'][vehicle]['lat'] == 10.8
        assert live['positions'][vehicle]['tracking']
        assert client.get('/api/driver', headers=second_auth).json()['position'] is None
        assert client.post('/api/driver/position', headers=driver_auth, json=fix).status_code == 409
        assert client.post('/api/driver/position', headers=driver_auth, json={**fix, 'recordedAt': fix['recordedAt'] - 180000}).status_code == 422
        assert client.post('/api/driver/action', headers=driver_auth, json={'action': 'stop'}).status_code == 200
        assert not ws.receive_json()['positions'][vehicle]['tracking']
    renewed = client.post(f'/api/vehicles/{vehicle}/link', headers=AUTH)
    assert renewed.status_code == 200
    assert client.get('/api/driver', headers=driver_auth).status_code == 401
    assert client.post('/api/fleet/end', headers=AUTH).status_code == 200
    assert client.get('/api/driver', headers=second_auth).status_code == 401
    assert client.get('/api/fleet', headers=AUTH).json()['positions'] == {}


def test_active_plan_cannot_be_replaced_and_collection_is_scoped(client):
    dispatched = dispatch(client)
    result = client.post('/api/optimize', headers=AUTH, json=request()).json()
    rev = client.get('/api/fleet', headers=AUTH).json()['revision']
    assert client.post('/api/dispatch', headers=AUTH, json={'planId': result['planId'], 'revision': rev}).status_code == 409
    token = dispatched['links'][0]['token']
    auth = {'Authorization': 'Bearer ' + token}
    assert client.post('/api/driver/action', headers=auth, json={'action': 'finish'}).status_code == 409
    route = client.get('/api/driver', headers=auth).json()['route']
    other = next(r for r in dispatched['fleet']['plan']['routes'] if r['vehicle']['id'] != route['vehicle']['id'])
    assert client.post('/api/driver/action', headers=auth, json={'action': 'collected', 'stationId': other['stops'][0]['id']}).status_code == 404
    assert client.post('/api/driver/action', headers=auth, json={'action': 'collected', 'stationId': route['stops'][0]['id']}).status_code == 200
    assert client.post('/api/driver/action', headers=auth, json={'action': 'finish'}).status_code == 200
    assert client.post('/api/driver/position', headers=auth, json={'lat': 10, 'lng': 106, 'accuracy': 1, 'recordedAt': time.time() * 1000}).status_code == 409


def test_persistence_does_not_claim_live_after_restart(tmp_path, monkeypatch):
    monkeypatch.setenv('FLEET_DATA_DIR', str(tmp_path))
    path = tmp_path / 'persist.sqlite'
    with TestClient(create_app(path, KEY)) as client:
        data = dispatch(client)
        auth = {'Authorization': 'Bearer ' + data['links'][0]['token']}
        client.post('/api/driver/position', headers=auth, json={'lat': 10, 'lng': 106, 'accuracy': 1, 'recordedAt': time.time() * 1000})
    with TestClient(create_app(path, KEY)) as client:
        assert client.get('/api/driver', headers=auth).status_code == 200
        snapshot = client.get('/api/fleet', headers=AUTH).json()
        assert snapshot['plan']['id'] == data['fleet']['plan']['id']
        assert not next(iter(snapshot['positions'].values()))['tracking']


def test_estimated_roads_cannot_be_dispatched_and_revision_is_checked(client):
    body = request(); body['provider'] = 'estimate'
    result = client.post('/api/optimize', headers=AUTH, json=body).json()
    assert client.post('/api/dispatch', headers=AUTH, json={'planId': result['planId'], 'revision': 0}).status_code == 422
    result = client.post('/api/optimize', headers=AUTH, json=request()).json()
    assert client.post('/api/dispatch', headers=AUTH, json={'planId': result['planId'], 'revision': 99}).status_code == 409


def test_local_dev_bootstrap_rejects_foreign_origins_and_forwarded_clients(tmp_path, monkeypatch):
    monkeypatch.setenv('FLEET_DATA_DIR', str(tmp_path))
    with TestClient(create_app(tmp_path / 'dev.sqlite', KEY, True), base_url='http://127.0.0.1:5173', client=('127.0.0.1', 5000)) as client:
        assert client.post('/api/dev-session', headers={'Origin': 'https://foreign.example'}).status_code == 403
        assert client.post('/api/dev-session', headers={'Origin': 'http://localhost:5173', 'X-Forwarded-For': '10.0.0.1'}).status_code == 403
        assert client.post('/api/dev-session', headers={'Origin': 'http://localhost:5173'}).status_code == 200
