# backend/core/audio_manager.py
import os
import yt_dlp
from pathlib import Path

# --- RUTAS DE SERVIDOR ---
DOWNLOAD_DIR = Path("descargas")
DOWNLOAD_DIR.mkdir(exist_ok=True)

def descargar_youtube(url: str) -> dict:
    try:
        print(f"[YT] Preparando descarga web: {url}")
        out_template = str(DOWNLOAD_DIR / '%(title)s.%(ext)s')
        
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': out_template,
            'quiet': False,
            'no_warnings': True,
            # Ya no necesitamos decirle dónde está ffmpeg porque Linux ya lo sabe nativamente
            'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'wav', 'preferredquality': '0'}],
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(url, download=True)
            title = info_dict.get('title', 'Audio_Youtube')
            base_filename = ydl.prepare_filename(info_dict)
            final_path = os.path.splitext(base_filename)[0] + '.wav'
            
        return {"status": "success", "title": title, "file_path": final_path}
    except Exception as e:
        print(f"[YT] Error crítico: {e}")
        return {"status": "error", "message": str(e)}