#!/bin/sh
# Migrate, seed, activate models, create the admin (all idempotent), then run the worker in the
# background and the API in the foreground. Free hosts give one container, so both live here.
set -e
# The database can hiccup right after waking from idle; retry before giving up.
for attempt in 1 2 3 4; do
  alembic upgrade head && python -m app.cli bootstrap && break
  [ "$attempt" = 4 ] && exit 1
  echo "setup failed (attempt $attempt), retrying in 10s"; sleep 10
done
python -m app.worker &
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-7860}" --workers "${WEB_CONCURRENCY:-1}" \
  --proxy-headers --forwarded-allow-ips='*' --timeout-graceful-shutdown 20
