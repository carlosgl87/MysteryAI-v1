from io import BytesIO
from statistics import mean, median
from openpyxl import Workbook
from openpyxl.styles import Font

LABELS = {'human': 'Respuesta humana', 'bot': 'Solo bot', 'silent': 'No respondió'}


def excel(c, rows):
    book = Workbook()
    book.remove(book.active)
    companies = [c['own'], *c['competitors']]
    names = {co['id']: co['name'] for co in companies}
    eligible = [cr for cr in c['criteria'] if cr['scope'] == 'all' and all(
        any(r['co'] == co['id'] and cr['id'] in r['scores'] for r in rows) for co in companies)]
    summary = [['Campaña', c['name']], ['Origen', 'Simulación ficticia'], ['Versión rúbrica', c.get('rubric_version', '')], [],
               ['Empresa', 'Pruebas', 'Respuesta humana', 'Solo bot', 'No respondió', 'Nota global / 5', 'Mediana primera respuesta humana (min)']]
    quality = [['Empresa', 'Criterio', 'Alcance', 'Observación', 'Peso', 'Nota / 5', 'Pruebas evaluadas']]
    quotes = [['Empresa', 'WhatsApp', 'Prueba', 'Precio PEN', 'Regular PEN', 'Promoción', 'Condiciones de pago', 'Oferta', 'Comparabilidad', 'Mensaje de evidencia']]
    detail = [['Prueba', 'Empresa', 'WhatsApp', 'Escenario', 'Estado', 'Minutos', 'Inicio', 'Cierre', 'Motivo de cierre', 'Versión rúbrica', 'Chat con IDs y timestamps', 'Notas y evidencia / estado']]
    for co in companies:
        subset = [r for r in rows if r['co'] == co['id']]
        values = []
        for cr in c['criteria']:
            scores = [r['scores'][cr['id']] for r in subset if cr['id'] in r['scores']]
            avg = mean(scores) if scores else None
            if cr in eligible and avg is not None:
                values.append((avg, cr.get('weight') or 1))
            quality.append([co['name'], cr['name'], cr['scope'], cr['mode'], cr.get('weight') or 1, avg, len(scores)])
        times = [r['minutes'] for r in subset if r['minutes'] is not None]
        summary.append([co['name'], len(subset), *[sum(r['type'] == t for r in subset) for t in ['human', 'bot', 'silent']],
                        sum(v*w for v,w in values)/sum(w for _,w in values) if values else None, median(times) if times else None])
    for r in rows:
        q = r['quote']
        if r['scenario'] == 'price':
            quotes.append([names[r['co']], r['number'], r['id'], q['amount'] if q else None, q['regular'] if q else None,
                           q['promo'] if q else None, q['terms'] if q else None, q['config'] if q else None,
                           ('Equivalente' if q['equivalent'] else 'No comparable directamente') if q else ('No cotizó' if r['type'] == 'human' else LABELS[r['type']]),
                           ', '.join(q['message_ids']) if q else None])
        chat = '\n'.join(f"{m['id']} | {m['timestamp']} | {m['sender']}: {m['text']}" for m in r['messages'])
        assessments = '\n'.join(f"{cr['name']}: {r['scores'].get(cr['id'], r['criterion_status'][cr['id']])} | {', '.join(r['evidence'].get(cr['id'], []))}" for cr in c['criteria'])
        detail.append([r['id'], names[r['co']], r['number'], r['scenario'], LABELS[r['type']], r['minutes'], r['started_at'], r['closed_at'], r['close_reason'], r['rubric_version'], chat, assessments])
    for title, data in [('Resumen comparativo', summary), ('Calidad de atención', quality), ('Cotizaciones', quotes), ('Detalle de pruebas', detail)]:
        sheet = book.create_sheet(title)
        for row in data:
            sheet.append(row)
            # Treat all user and chat content as text, including formula-looking input.
            for cell in sheet[sheet.max_row]:
                if isinstance(cell.value, str):
                    cell.data_type = 's'
        sheet.freeze_panes = 'A2'
        sheet.auto_filter.ref = sheet.dimensions
        for cell in sheet[1]:
            cell.font = Font(bold=True)
        for col in sheet.columns:
            sheet.column_dimensions[col[0].column_letter].width = min(60, max(18, max(len(str(x.value or '')) for x in col[:10]) + 2))
    output = BytesIO()
    book.save(output)
    return output.getvalue()
