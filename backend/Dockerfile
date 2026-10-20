# AgriSmart API / worker image. Same image, different command (see deploy/docker-compose.yml).
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# ffmpeg decodes the app's compressed voice recordings (m4a/aac) for speech recognition.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
COPY app ./app
RUN pip install .

COPY alembic.ini ./
COPY migrations ./migrations
COPY seeds ./seeds

# Never run as root.
RUN useradd --create-home --uid 10001 agrismart
USER agrismart

EXPOSE 8000
# Workers per container: ~1 per CPU core. Scale out with more containers, not threads.
# --proxy-headers + --forwarded-allow-ips: trust X-Forwarded-For only from the load balancer
# (the rate limiter keys on the real client IP).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-2} --proxy-headers --forwarded-allow-ips=${FORWARDED_ALLOW_IPS:-127.0.0.1} --timeout-graceful-shutdown 20"]
