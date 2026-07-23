# backend/core/audio_manager.py
import os
import re
import time
import requests
import yt_dlp
from pathlib import Path

DOWNLOAD_DIR = Path("descargas")
DOWNLOAD_DIR.mkdir(exist_ok=True)

def extract_video_id(url: str):
    """Extrae el código único del video para evitar errores de caracteres extraños"""
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11})", url)
    return match.group(1) if match else None

def descargar_youtube(url: str) -> dict:
    video_id = extract_video_id(url)
    if not video_id:
        return {"status": "error", "message": "URL de YouTube no válida."}

    temp_mp3 = str(DOWNLOAD_DIR / f'temp_{video_id}.mp3')
    out_wav = str(DOWNLOAD_DIR / f'Audio_{video_id}.wav')

    # =================================================================
    # INTENTO 1: RapidAPI con Retraso Táctico
    # =================================================================
    print(f"[YT] [1/3] Usando RapidAPI para el video: {video_id}")
    try:
        api_url = "https://youtube-mp36.p.rapidapi.com/dl"
        headers = {
            "x-rapidapi-key": "a6c7462bcamsh853ede28c74c558p17d9cdjsn576bba33cd9c",
            "x-rapidapi-host": "youtube-mp36.p.rapidapi.com"
        }
        res = requests.get(api_url, headers=headers, params={"id": video_id}, timeout=15)
        
        if res.status_code == 200:
            data = res.json()
            download_url = data.get("link")
            title = data.get("title", f"Pista_{video_id}")

            if download_url:
                print("[YT] Enlace premium obtenido con éxito.")
                
                # EL SECRETO: Esperamos 4 segundos a que el servidor origen termine de renderizar el archivo
                print("[YT] Esperando 4 segundos para evitar error 404...")
                time.sleep(4)
                
                # Intentamos descargar hasta 3 veces por si el servidor sigue ocupado
                for intento in range(3):
                    print(f"[YT] Iniciando descarga (Intento {intento + 1})...")
                    audio_res = requests.get(download_url, allow_redirects=True, timeout=60)
                    
                    if audio_res.status_code == 200:
                        with open(temp_mp3, "wb") as f:
                            f.write(audio_res.content)
                            
                        # Verificamos que el archivo tenga peso real
                        if os.path.getsize(temp_mp3) > 50000:
                            print("[YT] Audio descargado. Convirtiendo a WAV puro...")
                            os.system(f'ffmpeg -y -i "{temp_mp3}" "{out_wav}" -loglevel quiet')
                            
                            if os.path.exists(temp_mp3): os.remove(temp_mp3)
                            if os.path.exists(out_wav):
                                return {"status": "success", "title": title, "file_path": out_wav}
                    
                    print(f"[YT] El servidor origen dio error {audio_res.status_code}. Reintentando en 3s...")
                    time.sleep(3)
    except Exception as e:
        print(f"[YT] Falló RapidAPI: {e}")

    # =================================================================
    # INTENTO 2: API Cobalt Comunitaria (Respaldo)
    # =================================================================
    print("[YT] [2/3] Cambiando a servidor de respaldo Cobalt API...")
    try:
        c_url = "https://api.cobalt.tools/api/json"
        c_headers = {"Accept": "application/json", "Content-Type": "application/json"}
        c_payload = {"url": url, "isAudioOnly": True, "aFormat": "wav"}
        
        c_res = requests.post(c_url, json=c_payload, headers=c_headers, timeout=15)
        if c_res.status_code == 200:
            c_link = c_res.json().get("url")
            if c_link:
                print("[YT] Enlace de respaldo obtenido. Descargando...")
                audio_data = requests.get(c_link, timeout=60).content
                with open(out_wav, "wb") as f: 
                    f.write(audio_data)
                return {"status": "success", "title": f"Audio_{video_id}", "file_path": out_wav}
    except Exception as e:
        print(f"[YT] Cobalt falló: {e}")

    # =================================================================
    # INTENTO 3: Motor Interno yt-dlp (Bypass iOS)
    # =================================================================
    print("[YT] [3/3] Intentando motor local yt-dlp simulando iPhone...")
    try:
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': str(DOWNLOAD_DIR / f'ydl_{video_id}.%(ext)s'),
            'quiet': True,
            'extractor_args': {'youtube': {'player_client': ['ios']}},
            'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'wav'}],
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            base_filename = ydl.prepare_filename(info)
            final_path = os.path.splitext(base_filename)[0] + '.wav'
            return {"status": "success", "title": info.get('title', 'YouTube Audio'), "file_path": final_path}
    except Exception as e:
        print(f"[YT] Motor local falló: {e}")

    # Si se agotan todas las opciones
    return {
        "status": "error", 
        "message": "Los servidores detectaron inestabilidad temporal. Por favor, sube el archivo directamente desde tu equipo."
    }
