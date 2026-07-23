# MVP_Studio.py
import uvicorn
import os
import sys
from pathlib import Path

# Importamos la aplicación web
from backend.main import app

if __name__ == "__main__":
    # Detectamos el puerto que asigna Render (por defecto 10000)
    port = int(os.environ.get("PORT", 10000))
    print(f"[*] Iniciando MVP Studio Web en el puerto {port}...")
    
    # Iniciamos el servidor ASGI
    uvicorn.run(app, host="0.0.0.0", port=port)