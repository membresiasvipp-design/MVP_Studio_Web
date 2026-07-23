from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

class Licencia(BaseModel):
    codigo: str

# Reemplaza tu ruta antigua de activación con esta
@app.post("/api/activar")
async def activar_licencia(licencia: Licencia):
    # Convertimos a mayúsculas para aceptar "mvp-studio" o "MVP-STUDIO"
    if licencia.codigo.strip().upper() == "MVP-STUDIO":
        return {"status": "success", "message": "Licencia validada correctamente"}
    else:
        raise HTTPException(status_code=401, detail="Código incorrecto")
