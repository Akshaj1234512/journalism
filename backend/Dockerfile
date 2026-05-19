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

# Copy pyproject AND source together before installing. setuptools' src
# layout needs to see src/ at install time, so we cannot split this into
# two layers without breaking editable-mode or find-packages.
COPY pyproject.toml ./
COPY src/ ./src/

# Non-editable install. The container is immutable, so editable mode is
# unnecessary and was the cause of the original 'src does not exist'
# build failure on Hugging Face.
RUN pip install --upgrade pip && pip install .

EXPOSE 7860

# Bind to 0.0.0.0 so the container is reachable; use $PORT for hosts that
# inject one, fall back to 7860 for HF Spaces.
CMD ["sh", "-c", "uvicorn red_room.api:app --host 0.0.0.0 --port ${PORT:-7860}"]
