# backend/core/audio_manager.py
import os
import yt_dlp
from pathlib import Path

# --- RUTAS DE SERVIDOR ---
DOWNLOAD_DIR = Path("descargas")
DOWNLOAD_DIR.mkdir(exist_ok=True)

def descargar_youtube(url: str) -> dict:
    try:
        print(f"[YT] Preparando descarga web en servidor: {url}")
        out_template = str(DOWNLOAD_DIR / '%(title)s.%(ext)s')
        
        ydl_opts = {
            'format': 'ba/ba*/bestaudio/best', # Prioriza solo audio
            'outtmpl': out_template,
            'quiet': False,
            'no_warnings': True,
            # Forzamos cabeceras de navegador real y clientes móviles que evitan bloqueos de IP
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            },
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'web', 'ios'], # Intenta varias identidades si una falla
                }
            },
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '0'
            }],
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(url, download=True)
            title = info_dict.get('title', 'Audio_Youtube')
            base_filename = ydl.prepare_filename(info_dict)
            final_path = os.path.splitext(base_filename)[0] + '.wav'
            
        print(f"[YT] Descarga exitosa: {final_path}")
        return {"status": "success", "title": title, "file_path": final_path}

    except Exception as e:
        error_msg = str(e)
        print(f"[YT] Error crítico en el servidor: {error_msg}")
        return {"status": "error", "message": f"Error de YouTube en la nube: {error_msg}"}
