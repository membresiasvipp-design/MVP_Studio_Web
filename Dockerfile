# Usamos una versión ligera de Python y Linux
FROM python:3.10-slim

# Le decimos a Linux que instale FFmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Creamos nuestra carpeta de trabajo
WORKDIR /app

# Copiamos e instalamos las librerías
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiamos todo nuestro proyecto
COPY . .

# Creamos carpetas internas seguras para las descargas
RUN mkdir -p descargas data output

# Comando para encender el servidor web en el puerto 10000
CMD ["uvicorn", "MVP_Studio:app", "--host", "0.0.0.0", "--port", "10000"]