from concurrent.futures import ThreadPoolExecutor
import sqlite3

from fastapi.testclient import TestClient
import pytest

from .rewards_app import create_app

KEY = 'rewards-test-operator-key-1234567890'
PASSWORD = 'Green-password-2026'


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path / 'rewards.db', admin_key=KEY, sample=True)) as c:
        yield c


def account(client, email='member@example.test'):
    r = client.post('/api/rewards/auth/register',json={'email':email,'password':PASSWORD,'name':'Minh Anh'})
    assert r.status_code == 201, r.text
    return {'Authorization':'Bearer '+r.json()['token']}


def test_accounts_profile_login_logout_and_isolation(client):
    a, b = account(client), account(client,'another@example.test')
    assert client.get('/api/rewards/me').status_code == 401
    assert client.get('/api/rewards/me',headers=a).json()['points'] == 1250
    assert client.patch('/api/rewards/me',headers=a,json={'name':'Tên mới','phone':'0900000000'}).status_code == 200
    assert client.get('/api/rewards/me',headers=b).json()['name'] == 'Minh Anh'
    assert client.post('/api/rewards/auth/login',json={'email':'MEMBER@EXAMPLE.TEST','password':PASSWORD}).status_code == 200
    assert client.post('/api/rewards/auth/login',json={'email':'member@example.test','password':'not-the-correct-password'}).status_code == 401
    assert client.post('/api/rewards/auth/register',json={'email':'bad-email','password':PASSWORD,'name':'Name'}).status_code == 422
    client.post('/api/rewards/auth/logout',headers=a)
    assert client.get('/api/rewards/me',headers=a).status_code == 401
    assert client.get('/api/rewards/me',headers=b).status_code == 200


def test_redemption_is_atomic_idempotent_and_private(client):
    a, b = account(client), account(client,'second@example.test')
    body={'reward_id':'coffee-01','request_id':'same-request-00000001'}
    first=client.post('/api/rewards/redeem',headers=a,json=body)
    assert first.status_code == 200, first.text
    retry=client.post('/api/rewards/redeem',headers=a,json=body)
    assert retry.json()['code'] == first.json()['code']
    assert client.get('/api/rewards/me',headers=a).json()['points'] == 800
    assert len(client.get('/api/rewards/wallet',headers=a).json()) == 1
    assert client.get('/api/rewards/wallet',headers=b).json() == []
    assert client.post('/api/rewards/redeem',headers=a,json={**body,'reward_id':'bag-01'}).status_code == 409
    forged={**body,'request_id':'different-request-01','points':1}
    assert client.post('/api/rewards/redeem',headers=a,json=forged).status_code == 422
    denied=client.post('/api/rewards/redeem',headers=a,json={'reward_id':'bottle-01','request_id':'not-enough-points-01'})
    assert denied.status_code == 409
    assert client.get('/api/rewards/me',headers=a).json()['points'] == 800


def test_concurrent_redeems_cannot_overspend(client):
    auth=account(client)
    def redeem(i):
        return client.post('/api/rewards/redeem',headers=auth,json={'reward_id':'bag-01','request_id':f'concurrent-request-{i:05d}'}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(redeem,[1,2])) == [200,409]
    assert client.get('/api/rewards/me',headers=auth).json()['points'] == 450


def test_operator_credit_idempotency_use_and_stock(client):
    auth=account(client)
    user=client.get('/api/rewards/me',headers=auth).json()
    body={'user_id':user['id'],'points':300,'reference':'station-tx-01','description':'Trả chai tại RE-001'}
    assert client.post('/api/rewards/operator/credit',headers=auth,json=body).status_code == 401
    op={'Authorization':'Bearer '+KEY}
    for _ in range(2):
        assert client.post('/api/rewards/operator/credit',headers=op,json=body).json()['points'] == 1550
    assert client.post('/api/rewards/operator/credit',headers=op,json={**body,'points':301}).status_code == 409
    row=client.get('/api/rewards/catalog').json()['items'][0]
    row['stock']=1
    row['sample']=bool(row['sample']);row['active']=bool(row['active'])
    assert client.post('/api/rewards/operator/catalog',headers=op,json=row).status_code == 200
    gift=client.post('/api/rewards/redeem',headers=auth,json={'reward_id':row['id'],'request_id':'operator-gift-00001'}).json()
    assert client.post('/api/rewards/redeem',headers=auth,json={'reward_id':row['id'],'request_id':'operator-gift-00002'}).status_code == 409
    assert client.post('/api/rewards/operator/use/'+gift['code'],headers=auth).status_code == 401
    assert client.post('/api/rewards/operator/use/'+gift['code'],headers=op).status_code == 200
    assert client.post('/api/rewards/operator/use/'+gift['code'],headers=op).status_code == 409
    assert client.get('/api/rewards/wallet',headers=auth).json()[0]['status'] == 'used'


def test_password_change_revokes_all_sessions_and_account_deletion(client):
    auth=account(client)
    assert client.post('/api/rewards/me/password',headers=auth,json={'password':PASSWORD,'new_password':'A-new-green-password'}).status_code == 200
    assert client.get('/api/rewards/me',headers=auth).status_code == 401
    signed=client.post('/api/rewards/auth/login',json={'email':'member@example.test','password':'A-new-green-password'}).json()
    auth={'Authorization':'Bearer '+signed['token']}
    assert client.request('DELETE','/api/rewards/me',headers=auth,json={'password':PASSWORD}).status_code == 400
    assert client.request('DELETE','/api/rewards/me',headers=auth,json={'password':'A-new-green-password'}).status_code == 200
    assert client.get('/api/rewards/me',headers=auth).status_code == 401


def test_production_has_no_free_points_or_sample_catalog_and_persists(tmp_path):
    path=tmp_path/'real.db'
    with TestClient(create_app(path,admin_key=KEY,sample=False)) as c:
        auth=account(c)
        assert c.get('/api/rewards/me',headers=auth).json()['points'] == 0
        assert c.get('/api/rewards/catalog').json()['items'] == []
    with TestClient(create_app(path,admin_key=KEY,sample=False)) as c:
        assert c.get('/api/rewards/me',headers=auth).status_code == 200
    with sqlite3.connect(path) as db:
        stored=db.execute('SELECT password FROM users').fetchone()[0]
        assert PASSWORD not in stored and ':' in stored
        assert auth['Authorization'][7:] != db.execute('SELECT token FROM sessions').fetchone()[0]


def test_auth_throttling(client):
    for _ in range(20):
        assert client.post('/api/rewards/auth/login',json={'email':'none@example.test','password':PASSWORD}).status_code == 401
    assert client.post('/api/rewards/auth/login',json={'email':'none@example.test','password':PASSWORD}).status_code == 429
