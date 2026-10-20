# One container for a free host (Hugging Face Docker Space): API + worker + first-run setup.
# Build context is the folder made by build-space.ps1: backend/ (code, seeds, migrations),
# models/ (ONNX/XGBoost artifacts), start.sh.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    MODEL_DIR=/models WEB_DIR=/web ENVIRONMENT=production WEB_CONCURRENCY=1 ML_MAX_CONCURRENCY=2

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face runs containers as uid 1000.
RUN useradd --create-home --uid 1000 agrismart
WORKDIR /app
COPY backend/pyproject.toml ./
COPY backend/app ./app
RUN pip install .
COPY backend/alembic.ini ./
COPY backend/migrations ./migrations
COPY backend/seeds ./seeds
COPY models /models
COPY web /web
COPY start.sh ./start.sh
RUN chown -R agrismart /app /models && chmod +x start.sh
USER agrismart

EXPOSE 7860
CMD ["./start.sh"]
