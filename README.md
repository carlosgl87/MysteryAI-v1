# MysteryAI v1

Demo comercial con el front aprobado, FastAPI y PostgreSQL. **Solo simulación:** no contiene conexión con WAHA, no usa claves de modelos y no envía mensajes reales.

## Arranque local

```sh
docker compose up --build
```

Abre http://localhost:8000. Compose crea un Postgres aparte con volumen persistente y carga una campaña ficticia de admisiones reproducible. Las credenciales del compose son exclusivamente locales. No uses `docker compose down -v` si quieres conservar esos datos.

Para desarrollo sin contenedor de aplicación (Python 3.12 y PostgreSQL 16):

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements-dev.txt
export DATABASE_URL='postgresql://postgres:test@127.0.0.1:55432/mysteryai'
alembic upgrade head
python -m backend.seed  # opcional, idempotente; datos ficticios fijos
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

La aplicación lee variables del entorno; `.env.example` sirve como referencia, no se carga automáticamente fuera de Compose. La base debe existir; las migraciones crean el esquema. `DATABASE_URL` es obligatorio en Railway. Se aceptan URLs `postgres://`, `postgresql://` y `postgresql+psycopg://`.

## Recorrido

1. Nueva campaña: completa nombre, sector y oferta de referencia.
2. Aplica una plantilla o pega texto libre, propone criterios y revísalos. Edita alcance, observación y pesos (por defecto 1; omitir/null equivale a 1 en API).
3. Registra uno o varios números por empresa y elige escenarios/muestra.
4. Guarda un borrador o simula. La ejecución es sin conexión; los números se usan solo como identificadores.
5. Revisa comparativa, filtros, detalle por canal y chat. Selecciona una nota para abrir su evidencia y los mensajes originales con IDs y timestamps.
6. Descarga el Excel de cuatro hojas. Los estados separan respuesta humana, solo bot, no respondió, no cotizó y no aplica. Las ofertas distintas se marcan «No comparable directamente».

Guardar requiere respuesta exitosa del servidor; los errores permanecen visibles y permiten reintentar. No se usa almacenamiento del navegador como base de campañas. La URL conserva la campaña seleccionada al recargar. Los resultados completos son inmutables: usa «Duplicar y editar» para cambiar una campaña sin perder su rúbrica/evidencia.

## Railway: servicio de aplicación + Postgres

- Configura el repositorio `carlosgl87/MysteryAI-v1`, rama **staging**, con despliegue automático. No cambies `main`.
- Añade un servicio PostgreSQL y, en la aplicación, `DATABASE_URL=${{Postgres.DATABASE_URL}}` (ajusta `Postgres` al nombre real del servicio).
- Usa el Dockerfile del repositorio. `start.sh` ejecuta Alembic y arranca FastAPI sirviendo HTML y API en el `PORT` de Railway; no hace falta un servicio de front aparte.
- Opcional: `SEED_DEMO=1` carga la campaña ficticia solo si no existe. No sobrescribe campañas existentes. Desactívalo si prefieres empezar vacío.
- Opcional: configura `DEMO_PASSWORD` con una contraseña elegida en Railway. El servidor protege HTML, assets, API y Excel mediante `/login`, cookie firmada HttpOnly/SameSite y sesión de 12 horas. HTTPS añade `Secure`. `SESSION_SECRET` permite una firma independiente y estable; en su ausencia se usa la contraseña. Cambiar la firma invalida sesiones. Es una puerta de acceso compartida para demo, no un sistema multiusuario.
- `GET /healthz` permanece público: comprueba la conexión y devuelve solo `status`, con 503 si la base no responde. `railway.json` lo configura como health check.
- Usa una sola réplica de aplicación para esta demo. El proxy de Railway termina HTTPS; el servidor acepta sus encabezados reenviados.

La migración inicial es `migrations/versions/001_initial.py`. No borra datos al desplegar; el volumen persistente pertenece al servicio Postgres. El despliegue real requiere que Railway esté conectado a `staging` y tenga `DATABASE_URL`; el push por sí solo no permite comprobar esa configuración.

## Arquitectura e integración futura

- `backend/schemas.py`: límites y validación de configuración. Borradores incompletos permitidos; simulación exige configuración válida y limita la ejecución a 1000 pruebas.
- `backend/db.py`: campañas, pruebas con snapshot de rúbrica/evaluación, eventos con unicidad `(trial_id, provider_id)`.
- `backend/simulation.py`: `Buyer.propose(history, context, scenario)`, `Evaluator.evaluate(messages, context, rubric)` y `Transport.events(...)`. Los tres adaptadores actuales son locales. El comprador usa historial y criterios pendientes, sin servicio coordinador separado ni un número fijo de turnos.
- El reloj simulado empieza el 1 de noviembre de 2026 UTC para reproducibilidad. Se alternan humanos/bots/silencio. Las pruebas sin humano cierran al agotarse una ventana ficticia de 24 horas, sin esperar 24 horas reales. Se simula redelivery para probar deduplicación.
- El código calcula el tiempo desde consulta a primera respuesta humana; las medianas y notas globales usan únicamente criterios compartidos con evidencia en todos los canales comparados. No asigna cero a falta de respuesta. Las notas del evaluador son fixtures deterministas (no análisis semántico de un modelo).
- `backend/export.py`: Excel en servidor desde los resultados persistidos, con referencias a mensajes y contenido tratado como texto para evitar fórmulas inyectadas.

Para integrar un modelo, reemplaza comprador/evaluador conservando los contratos y exige respuestas estructuradas con IDs de mensajes existentes; mantén tiempos/agregados en código. Para WAHA, habrá que implementar transporte y webhook autenticado, mapear IDs del proveedor hacia `capture_event`, clasificar bot/humano con evidencia, y programar vencimientos persistentes. **No hay endpoint de envío real ni credenciales configuradas en esta versión.** Las ejecuciones actuales son síncronas y transaccionales: si fallan, no quedan resultados parciales; repetir una simulación completada devuelve la misma ejecución. La fila de campaña se bloquea para serializar reintentos concurrentes.

## Pruebas

Usa una base local/de pruebas, nunca producción. Ejecuta las migraciones antes:

```sh
python -m pytest -q
playwright install chromium
BASE_URL=http://127.0.0.1:8000 python tests/browser_flow.py
node --check front/app.js
```

Las pruebas API crean IDs únicos y limpian sus datos. El recorrido de navegador crea una campaña ficticia para verificar guardado de borrador, recarga, rúbrica, ejecución, evidencia, filtros, vista móvil y apertura del Excel; deja esa campaña local para inspección. El navegador verifica además que no haya solicitudes a proveedores externos. `BASE_URL` debe apuntar a una demo local desechable sin contraseña.

## Si no se puede publicar

Con el commit preparado en `staging`, desde un entorno con permisos de escritura:

```sh
git switch staging
git push origin staging
```

No se necesita merge a `main`. Revisa después el despliegue y `/healthz` en Railway.
