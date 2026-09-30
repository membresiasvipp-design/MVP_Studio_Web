FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DENO_INSTALL=/usr/local/deno \
    PATH=/usr/local/deno/bin:$PATH \
    BGUTIL_HOME=/opt/bgutil-ytdlp-pot-provider

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg ca-certificates curl unzip git \
    && rm -rf /var/lib/apt/lists/*

# Deno: runtime recomendado por yt-dlp/EJS.
RUN curl -fsSL https://deno.land/install.sh | sh \
    && ln -sf /usr/local/deno/bin/deno /usr/local/bin/deno \
    && deno --version

# PO Token Provider oficial/recomendado por la guía de yt-dlp.
# Se fija a 2.0.0 o superior por los cambios de seguridad del proveedor.
RUN git clone --depth 1 --branch 2.0.0 \
    https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git \
    /opt/bgutil-ytdlp-pot-provider \
    && cd /opt/bgutil-ytdlp-pot-provider/server \
    && deno install --allow-scripts=npm:canvas --frozen

WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && pip install --upgrade -r requirements.txt \
    && yt-dlp --version \
    && python -m pip show bgutil-ytdlp-pot-provider

COPY . .

ENV PORT=10000
EXPOSE 10000
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1 --timeout-keep-alive 120"]
