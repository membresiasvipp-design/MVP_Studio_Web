# backend/core/audio_manager.py
import os
import re
import requests
from pathlib import Path

DOWNLOAD_DIR = Path("descargas")
DOWNLOAD_DIR.mkdir(exist_ok=True)

def extract_video_id(url: str):
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11})", url)
    return match.group(1) if match else None

def descargar_youtube(url: str) -> dict:
    video_id = extract_video_id(url)
    if not video_id:
        return {"status": "error", "message": "URL no válida."}

    out_path = str(DOWNLOAD_DIR / f'Audio_{video_id}.mp3')
    print(f"[YT] Usando RapidAPI para descargar video: {video_id}")

    # Configuración de tu API (Reemplaza con el que elijas en RapidAPI)
    api_url = "https://youtube-mp36.p.rapidapi.com/dl"
    querystring = {"id": video_id}
    
    headers = {
        "x-rapidapi-key": "a6c7462bcamsh853ede28c74c558p17d9cdjsn576bba33cd9c",
        "x-rapidapi-host": "youtube-mp36.p.rapidapi.com"
    }

    try:
        # 1. Le pedimos a RapidAPI que genere el enlace de descarga limpio
        response = requests.get(api_url, headers=headers, params=querystring, timeout=15)
        data = response.json()
        
        # Cada API responde distinto, pero generalmente devuelven un 'link'
        download_url = data.get("link") 
        title = data.get("title", f"Pista_{video_id}")

        if download_url:
            print("[YT] Enlace premium obtenido. Descargando al servidor...")
            audio_data = requests.get(download_url, timeout=60).content
            
            with open(out_path, "wb") as f:
                f.write(audio_data)
                
            return {"status": "success", "title": title, "file_path": out_path}
        else:
            return {"status": "error", "message": "La API no pudo generar el enlace."}

    except Exception as e:
        print(f"[YT] Error en la API: {e}")
        return {"status": "error", "message": "Error de conexión con la API de descarga."}
