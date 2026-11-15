import hmac
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from sqlalchemy import select, text
from backend.db import Session, Campaign, Trial
from backend.schemas import CampaignInput
from backend.simulation import simulate
from backend.export import excel

app = FastAPI(title='MysteryAI · Simulación', docs_url=None, redoc_url=None, openapi_url=None)
password = os.environ.get('DEMO_PASSWORD', '')
signer = URLSafeTimedSerializer(os.environ.get('SESSION_SECRET') or password or secrets.token_hex(32), salt='mysteryai-demo')


@app.middleware('http')
async def protect(request: Request, call_next):
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        origin = request.headers.get('origin')
        if origin and origin != str(request.base_url).rstrip('/'):
            return Response('Origen no permitido', status_code=403)
    if password and request.url.path not in ('/healthz', '/login'):
        try:
            if signer.loads(request.cookies.get('demo_session', ''), max_age=43200) != 'demo':
                raise BadSignature('invalid')
        except (BadSignature, SignatureExpired):
            if request.url.path.startswith('/api/'):
                return Response('Acceso requerido', status_code=401)
            return RedirectResponse('/login', status_code=303)
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response


@app.get('/login', response_class=HTMLResponse)
def login_page():
    return '''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acceso · MysteryAI</title><body><main><h1>MysteryAI · Acceso a la demo</h1><form method="post" action="/login"><label>Contraseña <input name="password" type="password" required autofocus autocomplete="current-password"></label><button>Entrar</button></form></main></body></html>'''


@app.post('/login')
async def login(request: Request):
    form = await request.form()
    if password and not hmac.compare_digest(str(form.get('password', '')).encode(), password.encode()):
        return HTMLResponse('<p>Contraseña incorrecta. <a href="/login">Volver a intentar</a></p>', status_code=401)
    response = RedirectResponse('/', status_code=303)
    response.set_cookie('demo_session', signer.dumps('demo'), httponly=True, samesite='strict',
                        secure=request.url.scheme == 'https', max_age=43200)
    return response


@app.post('/logout')
def logout():
    response = RedirectResponse('/login', status_code=303)
    response.delete_cookie('demo_session')
    return response


@app.get('/healthz')
def health():
    try:
        with Session() as session:
            session.execute(text('SELECT 1'))
        return {'status': 'ok'}
    except Exception:
        return Response('{"status":"unavailable"}', status_code=503, media_type='application/json')


def fetch_campaign(session, campaign_id, lock=False):
    query = select(Campaign).where(Campaign.id == campaign_id)
    if lock:
        query = query.with_for_update()
    c = session.scalar(query)
    if not c:
        raise HTTPException(404, 'Campaña no encontrada')
    return c


def serialize(session, c):
    rows = session.scalars(select(Trial).where(Trial.campaign_id == c.id).order_by(Trial.id)).all()
    return {**c.config, 'status': c.status, 'rubric_version': c.rubric_version, 'results': [r.data for r in rows]}


@app.get('/api/campaigns')
def campaigns():
    with Session() as s:
        return [serialize(s, c) for c in s.scalars(select(Campaign).order_by(Campaign.created_at))]


@app.get('/api/campaigns/{campaign_id}')
def campaign(campaign_id: str):
    with Session() as s:
        return serialize(s, fetch_campaign(s, campaign_id))


@app.put('/api/campaigns/{campaign_id}')
def save_campaign(campaign_id: str, payload: CampaignInput):
    if campaign_id != payload.id:
        raise HTTPException(422, 'ID no coincide')
    with Session.begin() as s:
        c = s.scalar(select(Campaign).where(Campaign.id == campaign_id).with_for_update())
        if c and c.status == 'complete':
            raise HTTPException(409, 'Duplica la campaña para conservar los resultados originales')
        if not c:
            c = Campaign(id=campaign_id, created_at=datetime.now(timezone.utc), status='draft', rubric_version='')
            s.add(c)
        c.config = payload.model_dump()
        s.flush()
        return serialize(s, c)


@app.post('/api/campaigns/{campaign_id}/simulate')
def run_campaign(campaign_id: str):
    with Session.begin() as s:
        c = fetch_campaign(s, campaign_id, lock=True)
        if c.status == 'complete':
            return serialize(s, c)  # Retry-safe: no second execution or lost evidence.
        try:
            CampaignInput.model_validate(c.config).validate_run()
        except ValueError as exc:
            raise HTTPException(422, str(exc))
        simulate(s, c)
        s.flush()
        return serialize(s, c)


@app.get('/api/campaigns/{campaign_id}/excel')
def download(campaign_id: str):
    with Session() as s:
        c = serialize(s, fetch_campaign(s, campaign_id))
        if c['status'] != 'complete':
            raise HTTPException(409, 'Simula la campaña primero')
        return Response(excel(c, c['results']), media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        headers={'Content-Disposition': 'attachment; filename="MysteryAI-resultados.xlsx"'})


app.mount('/', StaticFiles(directory=Path(__file__).resolve().parent.parent / 'front', html=True), name='front')
