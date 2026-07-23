# backend/core/audio_manager.py
import os
import requests
import yt_dlp
from pathlib import Path

DOWNLOAD_DIR = Path("descargas")
DOWNLOAD_DIR.mkdir(exist_ok=True)

def descargar_youtube(url: str) -> dict:
    print(f"[YT] Iniciando descarga antibloqueo para: {url}")
    
    # ESTRATEGIA 1: Evadir la IP de Render usando una API externa (Cobalt)
    try:
        print("[YT] Intentando bypass mediante servidor externo...")
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
        payload = {
            "url": url,
            "isAudioOnly": True,
            "aFormat": "mp3"
        }
        
        response = requests.post("https://api.cobalt.tools/api/json", json=payload, headers=headers, timeout=20)
        
        if response.status_code == 200:
            data = response.json()
            direct_url = data.get("url")
            
            if direct_url:
                # Extraer un nombre corto para el archivo
                video_id = url.split("v=")[-1].split("&")[0][:11] if "v=" in url else "audio"
                final_path = str(DOWNLOAD_DIR / f"YT_{video_id}.mp3")
                
                # Descargamos el archivo final a nuestro servidor
                audio_data = requests.get(direct_url, timeout=60).content
                with open(final_path, "wb") as f:
                    f.write(audio_data)
                
                print(f"[YT] Éxito con Bypass: {final_path}")
                return {"status": "success", "title": f"YouTube Audio ({video_id})", "file_path": final_path}
    except Exception as e:
        print(f"[YT] Falló el bypass externo: {e}")

    # ESTRATEGIA 2: yt-dlp tradicional (Plan B)
    try:
        print("[YT] Usando motor interno yt-dlp...")
        out_template = str(DOWNLOAD_DIR / '%(title)s.%(ext)s')
        
        ydl_opts = {
            'format': 'ba/bestaudio',
            'outtmpl': out_template,
            'quiet': False,
            'nocheckcertificate': True,
            'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'}],
            'http_headers': {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'},
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title', 'Audio_Descargado')
            base_filename = ydl.prepare_filename(info)
            final_path = os.path.splitext(base_filename)[0] + '.mp3'
            
        return {"status": "success", "title": title, "file_path": final_path}

    except Exception as e:
        err = str(e)
        print(f"[YT] Error crítico general: {err}")
        return {
            "status": "error", 
            "message": "YouTube bloqueó la descarga temporalmente. Por favor, usa el botón de 'Subir Archivo Local'."
        }
