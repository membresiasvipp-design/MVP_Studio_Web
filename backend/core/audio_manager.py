# backend/core/audio_manager.py
from pathlib import Path

DOWNLOAD_DIR = Path("descargas")
DOWNLOAD_DIR.mkdir(exist_ok=True)

def descargar_youtube(url: str) -> dict:
    # Este backend ya no se usa para YouTube. La descarga ocurre en el navegador (app.js).
    return {
        "status": "error", 
        "message": "La descarga web está desactivada en el servidor. El archivo se descarga directamente en tu navegador."
    }
