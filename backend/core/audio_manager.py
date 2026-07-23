# backend/core/audio_manager.py
import os
import re
import requests
from pathlib import Path

DOWNLOAD_DIR = Path("descargas")
DOWNLOAD_DIR.mkdir(exist_ok=True)

def extract_video_id(url: str):
    """Extrae el ID del video para nombrar el archivo limpiamente"""
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11})", url)
    return match.group(1) if match else "Desconocido"

def descargar_youtube(url: str) -> dict:
    video_id = extract_video_id(url)
    if not video_id:
        return {"status": "error", "message": "URL de YouTube no válida."}

    out_path = str(DOWNLOAD_DIR / f'Audio_{video_id}.wav')
    print(f"[YT] Iniciando protocolo Ghost para el video: {video_id}")

    # =================================================================
    # RED DE SERVIDORES ESPEJO (Instancias de Cobalt)
    # =================================================================
    cobalt_instances = [
        "https://api.cobalt.tools/api/json",
        "https://co.wuk.sh/api/json",
        "https://cobalt.kwiatektv.com/api/json"
    ]

    # Le decimos a la API que queremos solo el audio en formato WAV
    payload = {
        "url": url,
        "isAudioOnly": True,
        "aFormat": "wav"
    }

    # EL SECRETO: Hacemos creer a la API que somos su propia página oficial
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Origin": "https://cobalt.tools",
        "Referer": "https://cobalt.tools/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }

    # Intentamos descargar saltando de un servidor a otro si uno falla
    for api_url in cobalt_instances:
        print(f"[YT] Contactando servidor espejo: {api_url}")
        try:
            res = requests.post(api_url, json=payload, headers=headers, timeout=20)
            
            if res.status_code == 200:
                data = res.json()
                
                # Si la API de Cobalt nos devuelve un error interno, saltamos al siguiente
                if data.get("status") == "error":
                    print(f"[YT] El servidor {api_url} fue bloqueado por YT. Buscando otro...")
                    continue
                    
                download_url = data.get("url")
                if download_url:
                    print("[YT] ¡Brecha de seguridad encontrada! Descargando pista de audio...")
                    
                    # Descargamos el archivo directamente a nuestro servidor
                    audio_data = requests.get(download_url, timeout=60).content
                    with open(out_path, "wb") as f:
                        f.write(audio_data)
                        
                    print("[YT] Audio guardado con éxito en el servidor.")
                    return {"status": "success", "title": f"YouTube_{video_id}", "file_path": out_path}
                    
        except Exception as e:
            print(f"[YT] El servidor {api_url} no responde: {e}")
            continue

    # Si los 3 servidores fallan, le pedimos al usuario que use la carga manual
    return {
        "status": "error", 
        "message": "Los escudos de YouTube están al máximo. Por favor, descarga la canción en tu celular/PC y usa la opción '2. Subir audio' (Nube Local)."
    }
