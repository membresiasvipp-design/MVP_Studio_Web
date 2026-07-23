# backend/main.py
import os
import shutil
import uuid
import threading
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

print("[*] Iniciando Backend en la Nube...")

from backend.core.auth_sheets import validar_y_activar
from backend.core.audio_manager import descargar_youtube
from backend.core.ai_separator import ai_engine, OUTPUT_DIR

app = FastAPI()

# --- RUTAS DE DIRECTORIO EN SERVIDOR ---
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

DOWNLOADS_DIR = Path("descargas")
DOWNLOADS_DIR.mkdir(exist_ok=True)

class ActivationRequest(BaseModel): codigo: str
class DownloadRequest(BaseModel): url: str
class ProcessRequest(BaseModel):
    file_path: str
    mode: str

background_tasks = {}

@app.get("/api/status")
def check_status(): 
    # En la web no bloqueamos globalmente por archivo para permitir sesiones independientes por cliente
    return {"activated": False}

@app.post("/api/activar")
def activar_software(request: ActivationRequest):
    if validar_y_activar(request.codigo):
        return {"status": "success"}
    raise HTTPException(status_code=401, detail="Código o licencia inválida.")

@app.post("/api/descargar")
def descargar_audio(request: DownloadRequest):
    print(f"[*] Petición de descarga web: {request.url}")
    res = descargar_youtube(request.url)
    if res["status"] == "success": 
        return res
    raise HTTPException(status_code=400, detail=res["message"])

@app.post("/api/upload")
async def upload_audio(file: UploadFile = File(...)):
    print(f"[*] Subiendo archivo directo desde cliente: {file.filename}")
    try:
        file_path = DOWNLOADS_DIR / file.filename
        with open(file_path, "wb") as buffer: 
            shutil.copyfileobj(file.file, buffer)
        return {"status": "success", "file_path": str(file_path), "title": file.filename}
    except Exception as e: 
        raise HTTPException(status_code=500, detail=f"Error al subir: {str(e)}")

@app.post("/api/procesar")
def procesar_audio(request: ProcessRequest):
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail="El archivo no existe en el servidor.")
    
    task_id = str(uuid.uuid4())
    background_tasks[task_id] = {"status": "processing", "message": "Procesando IA..."}
    
    threading.Thread(
        target=ai_engine.process_audio_task, 
        args=(request.file_path, request.mode, task_id, background_tasks)
    ).start()
    
    return {"status": "success", "task_id": task_id}

@app.get("/api/task/{task_id}")
def get_task_status(task_id: str):
    if task_id not in background_tasks: 
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return background_tasks[task_id]

# Montar carpetas estáticas
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")

@app.get("/")
def read_root(): 
    return FileResponse("static/index.html")
