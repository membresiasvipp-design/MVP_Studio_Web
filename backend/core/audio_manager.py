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
        # 1. Hacemos la petición a RapidAPI
        response = requests.get(api_url, headers=headers, params=querystring, timeout=20)
        
        # Si RapidAPI nos bloquea (ej. límite de cuota o error de clave)
        if response.status_code != 200:
            return {"status": "error", "message": f"Fallo en API (Código {response.status_code}): {response.text}"}
            
        data = response.json()
        
        # Si la API responde pero dice que hay un error con el video
        if data.get("status") != "ok" and data.get("msg") != "success":
             return {"status": "error", "message": f"Mensaje de la API: {data.get('msg', 'Error desconocido')}"}
        
        download_url = data.get("link") 
        title = data.get("title", f"Pista_{video_id}")

        if download_url:
            print(f"[YT] Enlace obtenido. Descargando audio...")
            dl_headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            audio_res = requests.get(download_url, headers=dl_headers, allow_redirects=True, timeout=60)
            
            # Si el enlace de descarga final falla
            if audio_res.status_code != 200:
                 return {"status": "error", "message": f"El enlace de descarga dio error {audio_res.status_code}"}

            with open(temp_mp3, "wb") as f:
                f.write(audio_res.content)
                
            if os.path.getsize(temp_mp3) < 50000:
                if os.path.exists(temp_mp3): os.remove(temp_mp3)
                return {"status": "error", "message": "El archivo descargado está vacío o corrupto."}
            
            print("[YT] Convirtiendo a WAV...")
            os.system(f'ffmpeg -y -i "{temp_mp3}" "{out_wav}" -loglevel quiet')
            
            if os.path.exists(temp_mp3): 
                os.remove(temp_mp3)
            
            if not os.path.exists(out_wav):
                return {"status": "error", "message": "Fallo interno al convertir el formato a WAV."}

            return {"status": "success", "title": title, "file_path": out_wav}
        else:
            return {"status": "error", "message": "La API no devolvió ningún enlace ('link')."}

    except requests.exceptions.Timeout:
        return {"status": "error", "message": "La API tardó demasiado en responder (Timeout)."}
    except Exception as e:
        return {"status": "error", "message": f"Error del sistema: {str(e)}"}
