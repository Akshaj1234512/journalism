# ---------------------------------------------------------------
# The Red Room — backend image.
# Works on Hugging Face Spaces, Fly.io, Render, Railway, and most
# other "give us a Dockerfile" hosts.
# ---------------------------------------------------------------
FROM python:3.11-slim

# Hugging Face Spaces defaults to listening on 7860 but other hosts
# typically inject a $PORT env var. Honour that if set.
ENV PORT=7860 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first so the layer caches well between code changes.
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e .

# Copy the application source.
COPY src/ ./src/

# Anthropic key, model, and CORS origins are passed as env vars by the
# host (Spaces "secrets", Fly secrets, Render environment, etc.).
EXPOSE 7860

# Bind to 0.0.0.0 so the container is reachable; use $PORT for hosts that
# inject one, fall back to 7860 for HF Spaces.
CMD ["sh", "-c", "uvicorn red_room.api:app --host 0.0.0.0 --port ${PORT:-7860}"]
