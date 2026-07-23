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
    return match.group(1) if match else None

def descargar_youtube(url: str) -> dict:
    video_id = extract_video_id(url)
    if not video_id:
        return {"status": "error", "message": "URL no válida."}

    # Definimos rutas temporales y finales
    temp_mp3 = str(DOWNLOAD_DIR / f'temp_{video_id}.mp3')
    out_wav = str(DOWNLOAD_DIR / f'Audio_{video_id}.wav')
    
    print(f"[YT] Usando RapidAPI para descargar video: {video_id}")

    api_url = "https://youtube-mp36.p.rapidapi.com/dl"
    querystring = {"id": video_id}
    
    headers = {
        "x-rapidapi-key": "a6c7462bcamsh853ede28c74c558p17d9cdjsn576bba33cd9c",
        "x-rapidapi-host": "youtube-mp36.p.rapidapi.com"
    }

    try:
        # 1. Obtener el enlace premium de la API
        response = requests.get(api_url, headers=headers, params=querystring, timeout=15)
        data = response.json()
        
        download_url = data.get("link") 
        title = data.get("title", f"Pista_{video_id}")

        if download_url:
            print(f"[YT] Enlace obtenido. Descargando audio de: {title}...")
            
            # 2. Descargar el archivo simulando un navegador real
            dl_headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
            audio_res = requests.get(download_url, headers=dl_headers, allow_redirects=True, timeout=60)
            
            # 3. Guardar temporalmente como MP3
            with open(temp_mp3, "wb") as f:
                f.write(audio_res.content)
                
            # 4. VERIFICACIÓN DE SEGURIDAD: Comprobar que no sea un HTML de error (debe pesar más de 100KB)
            if os.path.getsize(temp_mp3) < 100000:
                if os.path.exists(temp_mp3): os.remove(temp_mp3)
                return {"status": "error", "message": "La API devolvió un archivo vacío o bloqueado."}
            
            # 5. CONVERSIÓN PURA: Convertir el MP3 a WAV real usando FFmpeg para que la IA no falle
            print("[YT] Archivo validado. Convirtiendo a formato WAV real para la IA...")
            os.system(f'ffmpeg -y -i "{temp_mp3}" "{out_wav}" -loglevel quiet')
            
            # 6. Limpieza del archivo temporal
            if os.path.exists(temp_mp3): 
                os.remove(temp_mp3)
            
            # Confirmar que la conversión fue un éxito
            if not os.path.exists(out_wav):
                return {"status": "error", "message": "Fallo al convertir el formato para la IA."}

            return {"status": "success", "title": title, "file_path": out_wav}
        else:
            return {"status": "error", "message": "La API no pudo generar el enlace de descarga."}

    except Exception as e:
        print(f"[YT] Error en la API: {e}")
        return {"status": "error", "message": f"Error de descarga: {str(e)}"}
