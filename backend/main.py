from __future__ import annotations

import asyncio
import os
import shutil
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.control_client import ControlClient
from backend.mvsep_client import MvsepClient
from backend.session_auth import COOKIE_NAME, create_session, parse_session
from backend.youtube_downloader import download_youtube, probe_youtube

APP_NAME = os.getenv("APP_NAME", "MVP Studio IA")
MAX_UPLOAD_MB = float(os.getenv("MAX_UPLOAD_MB", "40"))
MAX_UPLOAD_BYTES = int(MAX_UPLOAD_MB * 1024 * 1024)
MAX_YOUTUBE_DURATION_SECONDS = int(os.getenv("MAX_YOUTUBE_DURATION_SECONDS", "1800"))
MAX_ACTIVE_JOBS = max(1, int(os.getenv("MAX_ACTIVE_JOBS", "2")))

ALLOWED_MODEL_IDS = {63, 40, 49, 30, 28, 26, 126, 48, 35, 25, 46, 123, 23, 9, 17, 19, 27, 43, 33, 0, 111, 112, 12, 53, 57, 34, 42, 41, 31, 66, 81, 101, 124, 102, 96, 83, 74, 90, 97, 72, 44, 37, 38, 105, 94, 76, 84, 85, 109, 86, 89, 95, 98, 128, 133, 29, 79, 106, 88, 58, 91, 99, 129, 130, 131, 110, 52, 65, 69, 70, 73, 54, 107, 108, 61, 67, 71, 75, 77, 78, 82, 87, 92, 93, 116, 132, 20, 10, 13, 7, 15, 16, 24, 36, 45, 56, 18, 22, 47, 59, 60, 117, 125, 122, 51, 50, 55, 68, 14, 39, 64, 103, 104, 118, 119, 120, 115, 62, 121, 80, 113, 114, 127}
OUTPUT_FORMATS = {0, 1, 2}

BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = BASE_DIR / "public"
TMP_ROOT = Path(os.getenv("MVP_TMP_DIR", "/tmp/mvpstudioia"))
TMP_ROOT.mkdir(parents=True, exist_ok=True)

app = FastAPI(title=APP_NAME)
control = ControlClient()
mvsep = MvsepClient(control)
tasks: dict[str, dict] = {}
tasks_lock = threading.RLock()
job_slots = threading.BoundedSemaphore(MAX_ACTIVE_JOBS)


def task_update(task_id: str, **values):
    with tasks_lock:
        current = tasks.setdefault(task_id, {})
        current.update(values)
        current["updated_at"] = time.time()


def task_snapshot(task_id: str) -> Optional[dict]:
    with tasks_lock:
        item = tasks.get(task_id)
        if not item:
            return None
        return {k: v for k, v in item.items() if k not in {"api_token", "remote_job"}}


def is_cancelled(task_id: str) -> bool:
    with tasks_lock:
        return bool(tasks.get(task_id, {}).get("cancel"))


def safe_unlink(path: str | Path | None):
    if not path:
        return
    try:
        Path(path).unlink(missing_ok=True)
    except Exception:
        pass


def normalized_model(model_id: int) -> int:
    return model_id if model_id in ALLOWED_MODEL_IDS else 63


def normalized_format(output_format: int) -> int:
    return output_format if output_format in OUTPUT_FORMATS else 2


def session_payload(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME, "")
    payload = parse_session(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Inicia sesión para continuar.")
    return payload


async def authenticated_user(request: Request, revalidate: bool = False) -> dict:
    payload = session_payload(request)
    username = str(payload.get("sub") or "").strip().lower()
    user = {
        "usuario": username,
        "id": str(payload.get("uid") or ""),
        "plan": str(payload.get("plan") or "PRO"),
    }
    if revalidate:
        try:
            user = await asyncio.to_thread(control.validate_user, username)
        except PermissionError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=f"No se pudo validar tu cuenta: {exc}",
            ) from exc
    return user


def ensure_task_owner(task_id: str, username: str) -> dict:
    with tasks_lock:
        item = tasks.get(task_id)
        if not item:
            raise HTTPException(status_code=404, detail="Trabajo no encontrado.")
        owner = str(item.get("owner") or "").strip().lower()
        if owner and owner != username:
            raise HTTPException(status_code=403, detail="No tienes acceso a este trabajo.")
        return item


def run_mvsep_file(task_id: str, path: str, model_id: int, output_format: int, source_label: str):
    try:
        with job_slots:
            if is_cancelled(task_id):
                task_update(task_id, status="cancelled", message="Proceso cancelado.")
                return

            task_update(task_id, status="uploading_mvsep", phase="uploading_mvsep",
                        progress=0.0, message=f"Enviando {source_label} al servidor IA…")
            job = mvsep.create_from_file(
                path=path,
                model_id=model_id,
                output_format=output_format,
                task_id=task_id,
                task_update=task_update,
                cancelled=lambda: is_cancelled(task_id),
            )
            if is_cancelled(task_id):
                mvsep.cancel(job)
                task_update(task_id, status="cancelled", message="Proceso cancelado.")
                return

            task_update(task_id, remote_hash=job.get("hash", ""), remote_region=job.get("region_name", "AUTO"))
            safe_unlink(path)
            mvsep.wait_for_result(
                job=job,
                task_id=task_id,
                task_update=task_update,
                cancelled=lambda: is_cancelled(task_id),
            )
    except Exception as exc:
        task_update(task_id, status="error", message=str(exc))
    finally:
        safe_unlink(path)


def run_remote_link(task_id: str, url: str, remote_type: str, model_id: int, output_format: int):
    try:
        with job_slots:
            task_update(task_id, status="connecting", phase="connecting", message="Enviando enlace al servidor IA…")
            job = mvsep.create_from_link(
                url=url,
                remote_type=remote_type,
                model_id=model_id,
                output_format=output_format,
                task_id=task_id,
                task_update=task_update,
                cancelled=lambda: is_cancelled(task_id),
            )
            task_update(task_id, remote_hash=job.get("hash", ""), remote_region=job.get("region_name", "AUTO"))
            mvsep.wait_for_result(
                job=job,
                task_id=task_id,
                task_update=task_update,
                cancelled=lambda: is_cancelled(task_id),
            )
    except Exception as exc:
        task_update(task_id, status="error", message=str(exc))


def run_youtube(task_id: str, url: str, model_id: int, output_format: int):
    temp_dir = TMP_ROOT / task_id
    temp_dir.mkdir(parents=True, exist_ok=True)
    path = None
    try:
        with job_slots:
            task_update(task_id, status="youtube_info", phase="youtube", progress=0.0,
                        message="Analizando enlace de YouTube…")
            meta = probe_youtube(url)
            duration = int(meta.get("duration") or 0)
            if duration and duration > MAX_YOUTUBE_DURATION_SECONDS:
                raise RuntimeError(
                    f"El video supera el límite web de {MAX_YOUTUBE_DURATION_SECONDS // 60} minutos. "
                    "Para archivos largos usa Drive, Dropbox o MEGA."
                )

            task_update(task_id, title=meta.get("title") or "YouTube",
                        status="youtube_downloading", phase="youtube", progress=0.0,
                        message="Descargando audio de YouTube…")

            result = download_youtube(
                url=url,
                output_dir=temp_dir,
                progress=lambda pct, msg, speed="": task_update(
                    task_id,
                    status="youtube_downloading",
                    phase="youtube",
                    progress=round(float(pct), 1),
                    message=msg,
                    transfer_speed=speed,
                ),
                cancelled=lambda: is_cancelled(task_id),
            )
            path = result["file_path"]
            task_update(task_id, title=result.get("title") or meta.get("title") or "YouTube",
                        status="youtube_ready", progress=100.0,
                        message="Audio descargado. Enviando al servidor IA…")

            job = mvsep.create_from_file(
                path=path,
                model_id=model_id,
                output_format=output_format,
                task_id=task_id,
                task_update=task_update,
                cancelled=lambda: is_cancelled(task_id),
            )
            safe_unlink(path)
            path = None
            task_update(task_id, remote_hash=job.get("hash", ""), remote_region=job.get("region_name", "AUTO"))
            mvsep.wait_for_result(
                job=job,
                task_id=task_id,
                task_update=task_update,
                cancelled=lambda: is_cancelled(task_id),
            )
    except Exception as exc:
        task_update(task_id, status="error", message=str(exc))
    finally:
        safe_unlink(path)
        shutil.rmtree(temp_dir, ignore_errors=True)


@app.post("/api/auth/login")
async def auth_login(request: Request):
    payload = await request.json()
    username = str(payload.get("usuario") or "").strip().lower()
    password = str(payload.get("password") or "")

    if not username or not password:
        raise HTTPException(status_code=400, detail="Ingresa usuario y contraseña.")

    try:
        user = await asyncio.to_thread(control.login, username, password)
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo conectar con el sistema de usuarios: {exc}",
        ) from exc

    token, max_age = create_session(user)
    response = JSONResponse({
        "ok": True,
        "user": {
            "usuario": user.get("usuario"),
            "plan": user.get("plan", "PRO"),
            "fecha_vence": user.get("fecha_vence", ""),
        },
    })
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return response


@app.get("/api/auth/me")
async def auth_me(request: Request):
    user = await authenticated_user(request, revalidate=True)
    token, max_age = create_session(user)
    response = JSONResponse({
        "ok": True,
        "user": {
            "usuario": user.get("usuario"),
            "plan": user.get("plan", "PRO"),
            "fecha_vence": user.get("fecha_vence", ""),
        },
    })
    # Sesión deslizante: cada visita válida renueva otros 90 días.
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return response


@app.post("/api/auth/logout")
def auth_logout():
    response = JSONResponse({"ok": True})
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=True,
        httponly=True,
        samesite="lax",
    )
    return response


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "app": APP_NAME,
        "platform": "Render",
        "youtube": True,
        "storage": "temporary-only",
        "auth": "user-password-persistent-session",
    }


@app.get("/api/config")
def config():
    return {
        "ok": True,
        "maxUploadBytes": MAX_UPLOAD_BYTES,
        "maxUploadMB": MAX_UPLOAD_MB,
        "maxYoutubeDurationSeconds": MAX_YOUTUBE_DURATION_SECONDS,
        "modelCount": len(ALLOWED_MODEL_IDS),
        "defaultModelId": 63,
        "youtubeEnabled": True,
        "remoteProviders": ["Google Drive", "Dropbox", "MEGA"],
        "outputFormats": [
            {"value": 0, "label": "MP3 320 kbps"},
            {"value": 1, "label": "WAV 16-bit"},
            {"value": 2, "label": "FLAC Lossless 16-bit"},
        ],
    }


@app.post("/api/upload")
async def upload_audio(
    request: Request,
    file: UploadFile = File(...),
    model_id: int = Form(63),
    output_format: int = Form(2),
):
    user = await authenticated_user(request, revalidate=True)
    model_id = normalized_model(int(model_id))
    output_format = normalized_format(int(output_format))
    task_id = uuid.uuid4().hex
    temp_path = TMP_ROOT / f"{task_id}_{Path(file.filename or 'audio.bin').name}"
    size = 0
    try:
        with open(temp_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"El archivo supera el máximo web de {MAX_UPLOAD_MB:.0f} MB. Usa Drive, Dropbox o MEGA.",
                    )
                out.write(chunk)
    except Exception:
        safe_unlink(temp_path)
        raise
    finally:
        await file.close()

    task_update(task_id, status="queued", phase="queued", progress=0.0,
                message="Audio recibido. Preparando envío al servidor IA…",
                input_type="file", filename=file.filename or "audio",
                owner=str(user.get("usuario") or "").lower())
    threading.Thread(
        target=run_mvsep_file,
        args=(task_id, str(temp_path), model_id, output_format, "tu audio"),
        daemon=True,
        name=f"MVP-file-{task_id[:8]}",
    ).start()
    return {"ok": True, "task_id": task_id}


@app.post("/api/youtube")
async def youtube_job(request: Request):
    user = await authenticated_user(request, revalidate=True)
    payload = await request.json()
    url = str(payload.get("url") or "").strip()
    model_id = normalized_model(int(payload.get("model_id", 63)))
    output_format = normalized_format(int(payload.get("output_format", 2)))
    if not ("youtube.com/" in url.lower() or "youtu.be/" in url.lower()):
        raise HTTPException(status_code=400, detail="Ingresa un enlace válido de YouTube.")

    task_id = uuid.uuid4().hex
    task_update(task_id, status="queued", phase="youtube", progress=0.0,
                message="Preparando motor de YouTube…", input_type="youtube",
                owner=str(user.get("usuario") or "").lower())
    threading.Thread(
        target=run_youtube,
        args=(task_id, url, model_id, output_format),
        daemon=True,
        name=f"MVP-youtube-{task_id[:8]}",
    ).start()
    return {"ok": True, "task_id": task_id}


@app.post("/api/link")
async def link_job(request: Request):
    user = await authenticated_user(request, revalidate=True)
    payload = await request.json()
    url = str(payload.get("url") or "").strip()
    remote = mvsep.classify_remote_url(url)
    if not remote:
        raise HTTPException(
            status_code=400,
            detail="Solo se permiten enlaces de Google Drive, Dropbox o MEGA.",
        )
    model_id = normalized_model(int(payload.get("model_id", 63)))
    output_format = normalized_format(int(payload.get("output_format", 2)))
    task_id = uuid.uuid4().hex
    task_update(task_id, status="queued", phase="link", progress=0.0,
                message="Preparando enlace remoto…", input_type="link",
                owner=str(user.get("usuario") or "").lower())
    threading.Thread(
        target=run_remote_link,
        args=(task_id, remote["url"], remote["type"], model_id, output_format),
        daemon=True,
        name=f"MVP-link-{task_id[:8]}",
    ).start()
    return {"ok": True, "task_id": task_id}


@app.get("/api/task/{task_id}")
def task_status(request: Request, task_id: str):
    payload = session_payload(request)
    username = str(payload.get("sub") or "").strip().lower()
    ensure_task_owner(task_id, username)
    item = task_snapshot(task_id)
    if not item:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado.")
    return {"ok": True, **item}


@app.post("/api/cancel/{task_id}")
def cancel_task(request: Request, task_id: str):
    payload = session_payload(request)
    username = str(payload.get("sub") or "").strip().lower()
    ensure_task_owner(task_id, username)
    with tasks_lock:
        tasks[task_id]["cancel"] = True
        job = tasks[task_id].get("remote_job")
    if job:
        try:
            mvsep.cancel(job)
        except Exception:
            pass
    task_update(task_id, status="cancelling", message="Cancelando proceso…")
    return {"ok": True}


@app.get("/")
def root():
    return FileResponse(PUBLIC_DIR / "index.html")


app.mount("/", StaticFiles(directory=PUBLIC_DIR, html=True), name="public")
