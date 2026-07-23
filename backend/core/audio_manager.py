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
        return {"status": "error", "message": "URL de YouTube no válida."}

    temp_mp3 = str(DOWNLOAD_DIR / f'temp_{video_id}.mp3')
    out_wav = str(DOWNLOAD_DIR / f'Audio_{video_id}.wav')
    
    print(f"[YT] Consultando RapidAPI para el video: {video_id}")

    api_url = "https://youtube-mp36.p.rapidapi.com/dl"
    querystring = {"id": video_id}
    
    headers = {
        "x-rapidapi-key": "a6c7462bcamsh853ede28c74c558p17d9cdjsn576bba33cd9c",
        "x-rapidapi-host": "youtube-mp36.p.rapidapi.com"
    }

    try:
        response = requests.get(api_url, headers=headers, params=querystring, timeout=20)
        if response.status_code != 200:
            print(f"[ERROR API] Código {response.status_code} - {response.text}")
            return {"status": "error", "message": f"Fallo en API (Código {response.status_code})"}
            
        data = response.json()
        download_url = data.get("link") 
        title = data.get("title", f"Pista_{video_id}")

        if download_url:
            print(f"[YT] Enlace obtenido: {download_url[:40]}... Intentando descargar.")
            
            # CAMUFLAJE: Engañamos al servidor final haciéndonos pasar por Chrome en Windows
            session = requests.Session()
            dl_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
                "Upgrade-Insecure-Requests": "1"
            }
            
            audio_res = session.get(download_url, headers=dl_headers, allow_redirects=True, timeout=60)
            
            if audio_res.status_code != 200:
                print(f"[ERROR DESCARGA] El enlace final nos bloqueó. HTTP {audio_res.status_code}")
                return {"status": "error", "message": f"El servidor de descarga bloqueó la petición (HTTP {audio_res.status_code})"}

            with open(temp_mp3, "wb") as f:
                f.write(audio_res.content)
                
            file_size = os.path.getsize(temp_mp3)
            print(f"[YT] Archivo bajado con éxito. Peso total: {file_size} bytes")
            
            # COMPROBACIÓN: Si pesa muy poco, Cloudflare nos mandó una página HTML de bloqueo
            if file_size < 50000:
                with open(temp_mp3, "r", encoding="utf-8", errors="ignore") as f:
                    print(f"[ERROR SEGURIDAD] Nos bloquearon con HTML. Contenido: {f.read()[:150]}")
                if os.path.exists(temp_mp3): os.remove(temp_mp3)
                return {"status": "error", "message": "Protección Anti-Bot detectada en el enlace de descarga."}
            
            print("[YT] Archivo 100% real. Convirtiendo formato a WAV para la IA...")
            os.system(f'ffmpeg -y -i "{temp_mp3}" "{out_wav}" -loglevel quiet')
            
            if os.path.exists(temp_mp3): 
                os.remove(temp_mp3)
            
            if not os.path.exists(out_wav):
                print("[ERROR FFMPEG] La conversión de audio falló.")
                return {"status": "error", "message": "Fallo al preparar el audio para la IA."}

            print("[YT] ¡Descarga y conversión exitosa!")
            return {"status": "success", "title": title, "file_path": out_wav}
        else:
            print(f"[ERROR API] La respuesta no tenía link: {data}")
            return {"status": "error", "message": "La API no devolvió ningún enlace válido."}

    except Exception as e:
        print(f"[ERROR CRÍTICO] {str(e)}")
        return {"status": "error", "message": f"Error interno: {str(e)}"}
