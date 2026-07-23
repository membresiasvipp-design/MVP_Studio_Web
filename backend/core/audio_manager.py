# backend/core/audio_manager.py
import os
import requests
import yt_dlp
from pathlib import Path

DOWNLOAD_DIR = Path("descargas")
DOWNLOAD_DIR.mkdir(exist_ok=True)

def descargar_youtube(url: str) -> dict:
    print(f"[YT] Iniciando protocolo de descarga sigiloso para: {url}")
    
    try:
        out_template = str(DOWNLOAD_DIR / '%(title)s.%(ext)s')
        
        # Opciones avanzadas para evadir BotGuard de YouTube en servidores nube
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': out_template,
            'quiet': False,
            'no_warnings': True,
            'nocheckcertificate': True,
            'geo_bypass': True,
            # ESTA ES LA CLAVE: Nos hacemos pasar por la app de Android oficial
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'ios', 'web_creator'],
                    'player_skip': ['webpage', 'configs', 'js']
                }
            },
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
            },
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '0'
            }],
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print("[YT] Extrayendo información y descargando...")
            info = ydl.extract_info(url, download=True)
            title = info.get('title', 'Audio_Descargado_YT')
            base_filename = ydl.prepare_filename(info)
            final_path = os.path.splitext(base_filename)[0] + '.wav'
            
        print(f"[YT] Éxito absoluto: {final_path}")
        return {"status": "success", "title": title, "file_path": final_path}

    except Exception as e:
        error_str = str(e)
        print(f"[YT] Error en la extracción: {error_str}")
        return {
            "status": "error", 
            "message": "YouTube está aplicando restricciones severas en este momento. Por favor usa la opción de 'Subir audio' (Nube local) mientras la IP se enfría."
        }
