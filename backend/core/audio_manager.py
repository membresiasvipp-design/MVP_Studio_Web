# backend/core/audio_manager.py
import os
import yt_dlp
from pathlib import Path

DOWNLOAD_DIR = Path("descargas")
DOWNLOAD_DIR.mkdir(exist_ok=True)

def descargar_youtube(url: str) -> dict:
    try:
        print(f"[YT] Intentando descarga en servidor: {url}")
        out_template = str(DOWNLOAD_DIR / '%(title)s.%(ext)s')
        
        # Configuración agresiva anti-bloqueos para Render/Linux
        ydl_opts = {
            'format': 'ba/ba*/bestaudio/best',
            'outtmpl': out_template,
            'quiet': False,
            'no_warnings': True,
            'nocheckcertificate': True,
            'ignoreerrors': False,
            'logtostderr': False,
            'addheaders': [
                ('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'),
                ('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'),
                ('Accept-Language', 'en-us,en;q=0.5'),
            ],
            'extractor_args': {
                'youtube': {
                    'player_client': ['mweb', 'android', 'ios'],
                    'skip': ['hls', 'dash']
                }
            },
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '0'
            }],
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title', 'Audio_Descargado')
            base_filename = ydl.prepare_filename(info)
            final_path = os.path.splitext(base_filename)[0] + '.wav'
            
        print(f"[YT] Éxito: {final_path}")
        return {"status": "success", "title": title, "file_path": final_path}

    except Exception as e:
        err = str(e)
        print(f"[YT] Error en la nube: {err}")
        return {
            "status": "error", 
            "message": "YouTube bloqueó la IP del servidor. Por favor usa la opción de 'Subir archivo de audio local' directo desde tu celular/PC."
        }
