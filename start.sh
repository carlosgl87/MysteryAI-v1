#!/bin/sh
set -eu
alembic upgrade head
if [ "${SEED_DEMO:-0}" = "1" ]; then
  python -m backend.seed
fi
exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
