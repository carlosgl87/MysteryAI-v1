"""Offline adapters only. No network clients or real message delivery."""
import hashlib
import json
from datetime import datetime, timedelta, timezone
from typing import Protocol
from sqlalchemy import select
from backend.db import Event, Trial

SCENARIOS = {
    'price': '¿Cuánto cuesta la oferta y qué incluye el precio?',
    'recommend': 'Trabajo por las tardes y estoy empezando. ¿Qué opción recomiendas y por qué?',
    'object': 'Otra empresa me cotizó menos. ¿Qué alternativa tienes para mi presupuesto?',
    'compare': 'Estoy comparando opciones. ¿Qué diferencia esta oferta de otras similares?',
}


class Buyer(Protocol):
    def propose(self, history: list[dict], context: dict, scenario: str) -> str | None: ...


class Evaluator(Protocol):
    def evaluate(self, messages: list[dict], context: dict, rubric: list[dict]) -> dict: ...


class Transport(Protocol):
    def events(self, text: str, context: dict, timestamp: datetime) -> list[dict]: ...


class SimulatedBuyer:
    def propose(self, history, context, scenario):
        if not history:
            return SCENARIOS[scenario] + ' Referencia: ' + context['offer']
        asked = {m.get('criterion_id') for m in history if m['sender'] == 'buyer'}
        for cr in context['criteria']:
            if applicable(cr, context['co']) and cr['mode'] == 'prompt' and cr['id'] not in asked:
                return '¿Puedes explicar ' + cr['name'] + '?'
        return None


def applicable(cr, co):
    return cr['scope'] == 'all' or cr['scope'] == ('own' if co == 'own' else 'competitor')


class SimulatedTransport:
    def events(self, text, context, timestamp):
        if context['type'] == 'silent':
            return []
        if context['type'] == 'bot':
            return [{'sender': 'bot', 'text': 'Respuesta automática: gracias por escribir. Selecciona una opción.',
                     'timestamp': (timestamp + timedelta(seconds=10)).isoformat()}]
        quote = None
        if context['scenario'] == 'price' and context['index'] % 4 != 3:
            equivalent = context['ci'] % 3 != 2
            quote = dict(amount=399 + context['ci'] * 30, regular=459 + context['ci'] * 30,
                         promo='Matrícula sin costo hasta fin del mes simulado',
                         terms='Cuotas mensuales; transferencia o tarjeta',
                         config=context['offer'] if equivalent else 'Alternativa con modalidad y duración distintas',
                         equivalent=equivalent, currency='PEN')
        answer = {
            'price': 'Podemos confirmar el alcance y los requisitos de la oferta.',
            'recommend': '¿Qué experiencia tienes? Recomiendo una opción nocturna por tu horario, con acompañamiento inicial.',
            'object': 'Entiendo tu presupuesto. Podemos ofrecer cuotas mensuales y revisar una promoción.',
            'compare': 'La diferencia está en el acompañamiento y la flexibilidad. Te comparto las condiciones.',
        }[context['scenario']]
        if quote:
            answer += f" Cuota S/ {quote['amount']}; regular S/ {quote['regular']}. {quote['config']}. {quote['promo']}. {quote['terms']}."
        elif context['scenario'] == 'price':
            answer += ' No tengo un precio confirmado.'
        answer += ' ¿Agendamos una llamada mañana para revisar tu caso?'
        return [{'sender': 'human', 'text': answer, 'quote': quote,
                 'timestamp': (timestamp + timedelta(minutes=4 + context['ci'] * 3 + context['index'] % 5)).isoformat()}]


class SimulatedEvaluator:
    def evaluate(self, messages, context, rubric):
        scores, evidence, statuses = {}, {}, {}
        human = [m for m in messages if m['sender'] == 'human']
        for cr in rubric:
            if not applicable(cr, context['co']):
                statuses[cr['id']] = 'No aplica'
                continue
            if not human:
                statuses[cr['id']] = 'Solo bot' if any(m['sender'] == 'bot' for m in messages) else 'No respondió'
                continue
            if cr['id'] == 'objection' and context['scenario'] != 'object':
                statuses[cr['id']] = 'No aplica'
                continue
            targeted = [m for m in human if m.get('criterion_id') == cr['id']]
            if cr['mode'] == 'prompt' and not targeted:
                statuses[cr['id']] = 'No aplica'
                continue
            msg = targeted[0] if targeted else human[0]
            # Deterministic offline fixture assessment, never a claim of model analysis.
            scores[cr['id']] = 4 if len(msg['text']) >= 80 else 3
            evidence[cr['id']] = [msg['id']]
            statuses[cr['id']] = 'Evaluado'
        quote_msg = next((m for m in human if m.get('quote')), None)
        return dict(scores=scores, evidence=evidence, criterion_status=statuses,
                    quote={**quote_msg['quote'], 'message_ids': [quote_msg['id']]} if quote_msg else None)


def capture_event(session, trial_id, provider_id, payload):
    """The unique constraint also enforces provider-event deduplication in PostgreSQL."""
    old = session.scalar(select(Event).where(Event.trial_id == trial_id, Event.provider_id == provider_id))
    if old:
        return old.payload
    payload = {**payload, 'id': trial_id + ':' + provider_id}
    session.add(Event(id=payload['id'], trial_id=trial_id, provider_id=provider_id, payload=payload))
    session.flush()
    return payload


def simulate(session, campaign, buyer=None, evaluator=None, transport=None):
    buyer, evaluator, transport = buyer or SimulatedBuyer(), evaluator or SimulatedEvaluator(), transport or SimulatedTransport()
    c = campaign.config
    version = hashlib.sha256(json.dumps(c['criteria'], sort_keys=True).encode()).hexdigest()
    campaign.rubric_version = version
    index = 0
    start = datetime(2026, 11, 1, 9, tzinfo=timezone.utc)
    for ci, co in enumerate([c['own'], *c['competitors']]):
        for p in co['phones']:
            for scenario in c['scenarios']:
                for repeat in range(c['sample']):
                    trial_id = f"{c['id']}/{co['id']}/{p['id']}/{scenario}/{repeat}"
                    # Every group of five covers human, bot, silence and a human with no quote.
                    kind = ['human', 'human', 'bot', 'silent', 'human'][index % 5]
                    ctx = dict(co=co['id'], ci=ci, index=index, type=kind, scenario=scenario,
                               offer=c['offer'], criteria=c['criteria'], number=p['number'])
                    trial = Trial(id=trial_id, campaign_id=c['id'], data={})
                    session.add(trial)
                    session.flush()
                    timestamp = start + timedelta(hours=index)
                    messages = []
                    def record(provider_id, payload):
                        event = capture_event(session, trial_id, provider_id, payload)
                        if not any(m['id'] == event['id'] for m in messages):
                            messages.append(event)
                        return event
                    record('initial', dict(sender='buyer', text=buyer.propose([], ctx, scenario), timestamp=timestamp.isoformat()))
                    for i, event in enumerate(transport.events(messages[0]['text'], ctx, timestamp)):
                        record(f'reply-{i}', event)
                        record(f'reply-{i}', event)  # Simulated webhook redelivery.
                    if kind == 'human':
                        while text := buyer.propose(messages, ctx, scenario):
                            cr = next(cr for cr in c['criteria'] if applicable(cr, co['id']) and cr['mode'] == 'prompt'
                                      and not any(m.get('criterion_id') == cr['id'] and m['sender'] == 'buyer' for m in messages))
                            timestamp = datetime.fromisoformat(messages[-1]['timestamp']) + timedelta(minutes=1)
                            record('ask-' + cr['id'], dict(sender='buyer', text=text, timestamp=timestamp.isoformat(), criterion_id=cr['id']))
                            record('answer-' + cr['id'], dict(sender='human',
                                   text=f"Sobre {cr['name']}: te comparto las condiciones y un ejemplo ficticio aplicable a {c['offer']}. Podemos revisarlo en una llamada.",
                                   timestamp=(timestamp + timedelta(minutes=2)).isoformat(), criterion_id=cr['id']))
                    evaluation = evaluator.evaluate(messages, ctx, c['criteria'])
                    first_human = next((m for m in messages if m['sender'] == 'human'), None)
                    minutes = ((datetime.fromisoformat(first_human['timestamp']) - datetime.fromisoformat(messages[0]['timestamp'])).total_seconds() / 60) if first_human else None
                    if 'speed' in evaluation['scores']:
                        evaluation['scores']['speed'] = 5 if minutes <= 5 else 4 if minutes <= 8 else 3 if minutes <= 12 else 2 if minutes <= 18 else 1
                    closed = datetime.fromisoformat(messages[-1]['timestamp']) if kind == 'human' else datetime.fromisoformat(messages[0]['timestamp']) + timedelta(hours=24)
                    trial.data = dict(id=trial_id, co=co['id'], phone=p['label'] or p['number'], number=p['number'],
                                      scenario=scenario, type=kind, minutes=minutes, **evaluation,
                                      messages=messages, rubric_version=version, rubric_snapshot=c['criteria'],
                                      started_at=messages[0]['timestamp'], closed_at=closed.isoformat(),
                                      close_reason='completed' if kind == 'human' else 'response_window_expired', simulated=True)
                    index += 1
    campaign.status = 'complete'
