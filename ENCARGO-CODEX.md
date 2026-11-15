# MysteryAI v1 · Encargo de implementación

## Punto de partida

- Conserva el diseño y flujo de `front/`, que contiene el prototipo aprobado.
- El Dockerfile inicial solo sirve el prototipo. Sustitúyelo por uno que inicie FastAPI, sirva el front y use el `PORT` de Railway.
- Construye en este repo nuevo. No toques el sitio previo de ChatGPT ni los repositorios históricos.

## Recorrido que debe funcionar

1. El jefe comercial crea una campaña. Parte de una plantilla de rúbrica o pega texto libre y revisa criterios sugeridos. La escala es 1–5 y los pesos son opcionales. Los criterios personalizados pueden ser compartidos o exclusivos, espontáneos o evaluados cuando se pregunta.
2. Configura sus números de WhatsApp y los de la competencia, uno o varios por empresa. Evalúa el canal, no a vendedores individuales. Escoge escenarios como consulta de producto y precio, recomendación, objeción y consulta por alternativas. El ejemplo inicial es admisiones.
3. Corre una campaña simulada con mensajes ficticios. El backend captura eventos, conserva los timestamps y la versión de la rúbrica, deduplica mensajes y cierra pruebas sin respuesta. Simula respuesta humana, solo bot y ausencia de respuesta. Todo debe persistir en PostgreSQL.
4. Conserva la comparativa por criterio entre canales, los filtros, la evidencia enlazada al chat y el Excel de cuatro hojas. La nota global es secundaria y se calcula con criterios compartidos comparables. Distingue no respondió, solo bot, no cotizó y no aplica. Compara lo cotizado por WhatsApp, promociones y condiciones de pago. Marca ofertas no equivalentes como «No comparable directamente».

## Backend y puesta en marcha

- FastAPI y PostgreSQL, usando `DATABASE_URL`, un único servicio de aplicación para el front y la API y un servicio Postgres aparte. Incluye migraciones, datos ficticios reproducibles y `GET /healthz`.
- Dos interfaces reemplazables. El comprador propone qué decir según el historial, el contexto y el escenario para el número asignado. El evaluador convierte el chat en notas y datos comerciales con referencias de mensajes. El código calcula tiempos y agregados. No uses un servicio coordinador separado ni un flujo rígido por cada turn.
- Implementa primero adaptadores simulados para ejecución, comprador y evaluación. Deja documentados los puntos de integración con WAHA y el modelo. No pidas claves, no conectes WAHA y no envíes chats reales. No incluyas datos ni credenciales de producción.
- Si existe la variable `DEMO_PASSWORD` en el backend, protege la demo en el servidor (HTML y API) con un flujo sencillo de acceso. El health check puede permanecer accesible sin credenciales y no debe mostrar datos sensibles. Documenta su configuración.
- Verifica el flujo completo, que una campaña y su resultado se conserven tras recargar, y que el Excel abra correctamente. Si falta acceso a un servicio, verifica localmente y sigue con el resto.
- Haz commit y push a `staging` al terminar los checks. No toques `main`. Si falla el push por permisos, conserva el trabajo y explica cómo publicar la rama. Incluye un resumen de pruebas, alcance y pasos pendientes.
