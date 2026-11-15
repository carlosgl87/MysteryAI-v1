import copy
import importlib
import json
import os
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook
from sqlalchemy import delete, func, select
from backend.db import Session, Campaign, Trial, Event
from backend import main


@pytest.fixture
def client():
    return TestClient(main.app)


@pytest.fixture
def config():
    c = json.loads(Path('backend/demo.json').read_text())
    c['id'] = 'test_' + uuid4().hex
    yield c
    with Session.begin() as s:
        ids = select(Trial.id).where(Trial.campaign_id == c['id'])
        s.execute(delete(Event).where(Event.trial_id.in_(ids)))
        s.execute(delete(Trial).where(Trial.campaign_id == c['id']))
        s.execute(delete(Campaign).where(Campaign.id == c['id']))


def save(client, config):
    response = client.put('/api/campaigns/' + config['id'], json=config)
    assert response.status_code == 200, response.text
    return '/api/campaigns/' + config['id']


def test_complete_persistent_flow_and_excel(client, config):
    path = save(client, config)
    assert client.get(path).json()['status'] == 'draft'
    assert client.get(path + '/excel').status_code == 409
    result = client.post(path + '/simulate')
    assert result.status_code == 200, result.text
    c = result.json()
    assert c['status'] == 'complete'
    rows = c['results']
    assert len(rows) == 54
    assert {r['type'] for r in rows} == {'human', 'bot', 'silent'}
    assert any(r['type'] == 'human' and r['scenario'] == 'price' and not r['quote'] for r in rows)
    assert any(r['quote'] and not r['quote']['equivalent'] for r in rows)
    assert TestClient(main.app).get(path).json() == c
    assert any(x['id'] == c['id'] for x in client.get('/api/campaigns').json())
    for r in rows:
        assert r['rubric_version'] == c['rubric_version']
        assert r['rubric_snapshot'] == c['criteria']
        assert r['closed_at'] >= r['started_at']
        messages = {m['id']: m for m in r['messages']}
        assert len(messages) == len(r['messages'])
        for criterion, ids in r['evidence'].items():
            assert all(i in messages for i in ids)
            assert 1 <= r['scores'][criterion] <= 5
        if r['type'] != 'human':
            assert r['scores'] == {} and r['minutes'] is None
            assert r['close_reason'] == 'response_window_expired'
        else:
            from datetime import datetime
            human = next(m for m in r['messages'] if m['sender'] == 'human')
            assert r['minutes'] == (datetime.fromisoformat(human['timestamp']) - datetime.fromisoformat(r['started_at'])).total_seconds()/60
    with Session() as s:
        assert s.scalar(select(func.count()).select_from(Event).join(Trial).where(Trial.campaign_id == c['id'])) == sum(len(r['messages']) for r in rows)
    assert client.post(path + '/simulate').json() == c
    assert client.put(path, json=config).status_code == 409
    response = client.get(path + '/excel')
    assert response.status_code == 200
    workbook = load_workbook(BytesIO(response.content))
    assert workbook.sheetnames == ['Resumen comparativo', 'Calidad de atención', 'Cotizaciones', 'Detalle de pruebas']
    assert workbook['Detalle de pruebas'].max_row == 55
    assert 'No comparable directamente' in str(list(workbook['Cotizaciones'].values))


def test_scopes_optional_weights_formula_safety(client, config):
    config['name'] = '=HYPERLINK("https://example.com")'
    config['criteria'][0]['weight'] = None
    config['criteria'].append(dict(id='exclusive', name='Solo propio', desc='Ejemplo', scope='own', mode='prompt', type='custom'))
    path = save(client, config)
    c = client.post(path + '/simulate').json()
    assert all('exclusive' not in r['scores'] and r['criterion_status']['exclusive'] == 'No aplica' for r in c['results'] if r['co'] != 'own')
    assert any('exclusive' in r['scores'] for r in c['results'] if r['co'] == 'own')
    book = load_workbook(BytesIO(client.get(path + '/excel').content))
    assert book['Resumen comparativo']['B1'].data_type == 's'


def test_validation_and_missing(client, config):
    assert client.get('/api/campaigns/missing').status_code == 404
    assert client.put('/api/campaigns/wrong', json=config).status_code == 422
    invalid = copy.deepcopy(config)
    invalid['sample'] = 999
    assert client.put('/api/campaigns/' + config['id'], json=invalid).status_code == 422
    config['own']['phones'][0]['number'] = 'not a number'
    path = save(client, config)
    assert client.post(path + '/simulate').status_code == 422
    assert client.get(path).json()['results'] == []


def test_concurrent_simulation_is_idempotent(client, config):
    path = save(client, config)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: TestClient(main.app).post(path + '/simulate'), range(2)))
    assert all(r.status_code == 200 for r in responses)
    assert responses[0].json() == responses[1].json()


def test_auth(monkeypatch):
    monkeypatch.setenv('DEMO_PASSWORD', 'fictional-test-password')
    importlib.reload(main)
    try:
        with TestClient(main.app) as browser:
            assert browser.get('/healthz').json() == {'status': 'ok'}
            assert browser.get('/', follow_redirects=False).status_code == 303
            assert browser.get('/app.js', follow_redirects=False).status_code == 303
            assert browser.get('/api/campaigns').status_code == 401
            assert browser.post('/login', data={'password': 'wrong'}).status_code == 401
            assert browser.post('/login', data={'password': 'fictional-test-password'}, headers={'origin': 'https://attacker.example'}).status_code == 403
            assert browser.post('/login', data={'password': 'fictional-test-password'}, follow_redirects=False).status_code == 303
            assert browser.get('/').status_code == 200
            assert browser.get('/api/campaigns').status_code == 200
            browser.post('/logout')
            assert browser.get('/api/campaigns').status_code == 401
    finally:
        monkeypatch.delenv('DEMO_PASSWORD')
        importlib.reload(main)
