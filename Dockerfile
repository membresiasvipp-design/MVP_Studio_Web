FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DENO_INSTALL=/usr/local/deno \
    PATH=/usr/local/deno/bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg ca-certificates curl unzip \
    && rm -rf /var/lib/apt/lists/*

# Deno >= 2.3 es el runtime recomendado actualmente por yt-dlp para YouTube/EJS.
RUN curl -fsSL https://deno.land/install.sh | sh \
    && ln -sf /usr/local/deno/bin/deno /usr/local/bin/deno \
    && deno --version

WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && pip install --upgrade -r requirements.txt \
    && yt-dlp --version

COPY . .

ENV PORT=10000
EXPOSE 10000
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1 --timeout-keep-alive 120"]
