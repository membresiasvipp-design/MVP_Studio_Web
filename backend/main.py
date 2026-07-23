from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
import os

# 1. ESTO ES LO QUE FALTABA: Inicializar la aplicación ANTES de usarla
app = FastAPI(title="MVP Studio")

# 2. Definir los modelos de datos
class Licencia(BaseModel):
    codigo: str

# 3. La ruta de activación que agregamos
@app.post("/api/activar")
async def activar_licencia(licencia: Licencia):
    # Convertimos a mayúsculas para aceptar "mvp-studio" o "MVP-STUDIO"
    if licencia.codigo.strip().upper() == "MVP-STUDIO":
        return {"status": "success", "message": "Licencia validada correctamente"}
    else:
        raise HTTPException(status_code=401, detail="Código incorrecto")

# 4. Tu ruta de procesamiento de Inteligencia Artificial
@app.post("/api/procesar")
async def procesar_audio(file: UploadFile = File(...)):
    try:
        # Aquí es donde llamas a tu script de separación (ai_separator.py)
        # Ejemplo:
        # from core.ai_separator import procesar_archivo
        # resultado = procesar_archivo(file.file)
        
        return JSONResponse(content={
            "status": "success", 
            "html": "<p style='color:#03dac6;'>Procesamiento de IA iniciado correctamente. Revisa tus archivos generados.</p>"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 5. Montar los archivos estáticos (Frontend)
# Buscamos la carpeta 'static' que está un nivel arriba de 'backend'
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
static_dir = os.path.join(base_dir, "static")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# 6. Ruta principal que carga tu index.html
@app.get("/", response_class=HTMLResponse)
async def root():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Error: No se encontró la carpeta estática o el index.html</h1>")
