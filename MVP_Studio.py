# MVP_Studio.py
import os
from pathlib import Path

# --- CONFIGURACIÓN CRÍTICA DEL PATH ---
# Esto asegura que librerías como audio-separator encuentren ffmpeg en nuestra carpeta bin local
BASE_DIR = Path(__file__).resolve().parent
BIN_DIR = BASE_DIR / "bin"

# Inyectamos la carpeta bin al PATH de Windows para esta sesión
if BIN_DIR.exists():
    os.environ["PATH"] += os.pathsep + str(BIN_DIR)
else:
    print(f"[!] Advertencia: No se encontró la carpeta {BIN_DIR}. Asegúrate de crearla y poner ffmpeg.exe dentro.")

import webview
import threading
import uvicorn
from backend.main import app

def iniciar_servidor():
    # Desactivamos los logs en consola para que se vea limpio
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="critical")

if __name__ == '__main__':
    print("[*] Iniciando motor MVP Studio IA...")
    
    # Iniciar FastAPI en un hilo en segundo plano
    t = threading.Thread(target=iniciar_servidor, daemon=True)
    t.start()
    
    # Crear la ventana nativa de escritorio
    ventana = webview.create_window(
        title="MVP Studio IA - Pro Edition", 
        url="http://127.0.0.1:8000",
        width=1280, 
        height=800,
        background_color='#05050A', # Fondo oscuro futurista
        min_size=(1000, 700)
    )
    
    webview.start()