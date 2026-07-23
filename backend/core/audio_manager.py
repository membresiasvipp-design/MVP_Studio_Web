# backend/core/audio_manager.py
import os
import re
import requests
import yt_dlp
from pathlib import Path

DOWNLOAD_DIR = Path("descargas")
DOWNLOAD_DIR.mkdir(exist_ok=True)

def extract_video_id(url: str):
    """Extrae el ID exacto de 11 caracteres de cualquier enlace de YouTube"""
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11})", url)
    return match.group(1) if match else None

def descargar_youtube(url: str) -> dict:
    video_id = extract_video_id(url)
    if not video_id:
        return {"status": "error", "message": "URL de YouTube no válida o no reconocida."}

    # Usaremos un nombre seguro para evitar errores en Linux por tildes o comillas
    out_path = str(DOWNLOAD_DIR / f'Audio_{video_id}.wav')
    temp_path = str(DOWNLOAD_DIR / f'temp_{video_id}')

    print(f"[YT] Iniciando INGENIERÍA DE TRIPLE BYPASS para: {video_id}")

    # =================================================================
    # MÉTODO 1: PIPED API (Red Descentralizada) - BYPASS TOTAL
    # =================================================================
    print("[YT] [1/3] Intentando extraer mediante Red Piped...")
    try:
        # Piped extrae la URL real de los servidores de Google sin ser detectado
        res = requests.get(f"https://pipedapi.kavin.rocks/streams/{video_id}", timeout=15)
        if res.status_code == 200:
            data = res.json()
            audio_streams = data.get("audioStreams", [])
            if audio_streams:
                # Buscamos el stream con mayor calidad
                best_audio = max(audio_streams, key=lambda x: x.get('bitrate', 0))
                audio_url = best_audio['url']
                
                print("[YT] [1/3] Enlace oculto encontrado. Descargando...")
                audio_data = requests.get(audio_url, timeout=60).content
                
                temp_ext = f"{temp_path}.m4a"
                with open(temp_ext, "wb") as f:
                    f.write(audio_data)
                
                # Convertimos a WAV usando el FFmpeg nativo de Render
                print("[YT] [1/3] Convirtiendo a WAV...")
                os.system(f'ffmpeg -y -i "{temp_ext}" "{out_path}" -loglevel quiet')
                if os.path.exists(temp_ext): os.remove(temp_ext)
                
                return {"status": "success", "title": data.get("title", f"Pista_{video_id}"), "file_path": out_path}
    except Exception as e:
        print(f"[YT] [1/3] Falló Piped API: {e}")


    # =================================================================
    # MÉTODO 2: COBALT API (Extracción de Alta Velocidad)
    # =================================================================
    print("[YT] [2/3] Intentando extraer mediante Cobalt API...")
    try:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        payload = {"url": url, "isAudioOnly": True}
        
        res = requests.post("https://api.cobalt.tools/api/json", json=payload, headers=headers, timeout=15)
        if res.status_code == 200:
            audio_url = res.json().get("url")
            if audio_url:
                print("[YT] [2/3] Bypass exitoso. Descargando...")
                audio_data = requests.get(audio_url, timeout=60).content
                
                temp_ext = f"{temp_path}.mp3"
                with open(temp_ext, "wb") as f:
                    f.write(audio_data)
                    
                os.system(f'ffmpeg -y -i "{temp_ext}" "{out_path}" -loglevel quiet')
                if os.path.exists(temp_ext): os.remove(temp_ext)
                
                return {"status": "success", "title": f"Pista_{video_id}", "file_path": out_path}
    except Exception as e:
        print(f"[YT] [2/3] Falló Cobalt API: {e}")


    # =================================================================
    # MÉTODO 3: YT-DLP DIRECTO (Modo Cliente Android)
    # =================================================================
    print("[YT] [3/3] Intentando yt-dlp con spoofing de cliente Android...")
    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': str(DOWNLOAD_DIR / f'YT_DLP_{video_id}.%(ext)s'),
            'quiet': True,
            'nocheckcertificate': True,
            'extractor_args': {
                'youtube': {'player_client': ['android', 'ios']}
            },
            'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'wav'}],
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            base_filename = ydl.prepare_filename(info)
            final_path = os.path.splitext(base_filename)[0] + '.wav'
            return {"status": "success", "title": info.get('title', f"Pista_{video_id}"), "file_path": final_path}
    except Exception as e:
        print(f"[YT] [3/3] Falló yt-dlp directo: {e}")


    # Si la seguridad es infranqueable ese día
    return {
        "status": "error", 
        "message": "Los servidores de YouTube bloquearon todos los escudos. Usa el botón de Subir Archivo localmente hoy."
    }
