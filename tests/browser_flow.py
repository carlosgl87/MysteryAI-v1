"""Run against a local, disposable demo: BASE_URL=http://127.0.0.1:8000 python tests/browser_flow.py."""
import os
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from playwright.sync_api import sync_playwright, expect
from openpyxl import load_workbook


def run():
    base = os.environ.get('BASE_URL', 'http://127.0.0.1:8000')
    title = 'Admisiones E2E ' + uuid4().hex[:8]
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        # A simulation must never send traffic to WhatsApp or an external provider.
        external = []
        page.on('request', lambda req: external.append(req.url) if not req.url.startswith(base) else None)
        page.goto(base)
        page.get_by_role('button', name='Nueva campaña', exact=True).click()
        page.locator('[data-path="name"]').fill(title)
        page.locator('[data-path="sector"]').fill('Educación')
        page.locator('[data-path="offer"]').fill('Software virtual, 24 meses')
        page.get_by_role('button', name='Guardar borrador', exact=True).click()
        expect(page.get_by_text('Borrador guardado en el servidor.', exact=True)).to_be_visible()
        campaign_url = page.url
        page.reload()
        expect(page.get_by_text(title, exact=True)).to_be_visible()
        page.get_by_role('button', name='Editar', exact=True).last.click()
        page.get_by_role('button', name='Continuar', exact=True).click()
        page.get_by_role('button', name='Plantilla de educación', exact=True).click()
        page.locator('#rubric-text').fill('Becas y empleabilidad')
        page.get_by_role('button', name='Proponer criterios', exact=True).click()
        page.get_by_role('button', name='Añadir todos', exact=True).click()
        page.get_by_role('button', name='Continuar', exact=True).click()
        page.locator('[data-path="own.name"]').fill('Horizonte ficticio')
        page.locator('[data-path="own.phones.0.number"]').fill('+51 900 000 901')
        page.get_by_role('button', name='Agregar competidor', exact=True).click()
        page.locator('[data-path="competitors.0.name"]').fill('Competencia ficticia')
        page.locator('[data-path="competitors.0.phones.0.number"]').fill('+51 900 000 902')
        page.get_by_role('button', name='Continuar', exact=True).click()
        page.get_by_role('button', name='Continuar', exact=True).click()
        page.get_by_role('button', name='Simular campaña', exact=True).click()
        expect(page.get_by_role('heading', name='Comparativa comercial', exact=True)).to_be_visible()
        expect(page.get_by_text('Campaña simulada y guardada. No se enviaron mensajes.', exact=True)).to_be_visible()
        page.reload()
        expect(page.get_by_role('heading', name='Comparativa comercial', exact=True)).to_be_visible()
        expect(page.get_by_text(title, exact=True)).to_be_visible()
        page.locator('.score-button').first.click()
        page.get_by_role('button', name='Ver chat', exact=True).first.click()
        expect(page.locator('#drawer')).to_contain_text('Rúbrica')
        expect(page.locator('#drawer')).to_contain_text('2026-11-')
        page.get_by_role('button', name='Cerrar', exact=True).click()
        with page.expect_download() as download:
            page.get_by_role('button', name='Descargar Excel', exact=True).click()
        result = download.value
        assert not result.failure()
        book = load_workbook(BytesIO(Path(result.path()).read_bytes()))
        assert len(book.sheetnames) == 4
        assert book['Detalle de pruebas'].max_row == 13
        page.get_by_role('button', name='Mi canal', exact=True).click()
        page.locator('[data-filter="status"]').select_option('silent')
        expect(page.get_by_role('heading', name='Conversaciones de prueba', exact=True)).to_be_visible()
        page.set_viewport_size({'width': 390, 'height': 844})
        page.screenshot(path='work/mobile.png', full_page=True)
        assert not errors, errors
        assert not external, external
        browser.close()
        print('Browser flow passed: draft, reload, rubric, simulation, evidence, Excel, filter, mobile, no external traffic.')


if __name__ == '__main__':
    run()
