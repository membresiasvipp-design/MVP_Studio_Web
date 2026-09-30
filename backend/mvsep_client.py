from __future__ import annotations

import os
import re
import threading
import time
from collections import deque

from backend.control_client import ControlClient
from pathlib import Path
from typing import Callable
from urllib.parse import urlparse, unquote

import requests
from requests.adapters import HTTPAdapter
from requests_toolbelt.multipart.encoder import MultipartEncoder, MultipartEncoderMonitor


class TokenProvider:
    def __init__(self, control_client: ControlClient | None = None):
        self.direct = os.getenv("MVSEP_API_TOKEN", "").strip()
        self.control = control_client or ControlClient()
        self._cache = deque()
        self._lock = threading.Lock()
        self._prefetching = False
        if not self.direct and self.control.configured():
            self._prefetch()

    def _fetch_control(self):
        return self.control.get_api_key()

    def _prefetch_worker(self):
        try:
            key = self._fetch_control()
            with self._lock:
                if key and len(self._cache) < 2:
                    self._cache.append(key)
        except Exception as exc:
            print("[MVSEP] Prefetch API:", exc)
        finally:
            with self._lock:
                self._prefetching = False

    def _prefetch(self):
        with self._lock:
            if self._prefetching or len(self._cache) >= 2:
                return
            self._prefetching = True
        threading.Thread(target=self._prefetch_worker, daemon=True).start()

    def get(self):
        if self.direct:
            return self.direct

        with self._lock:
            key = self._cache.popleft() if self._cache else ""

        if key:
            self._prefetch()
            return key

        if self.control.configured():
            key = self._fetch_control()
            self._prefetch()
            return key

        raise RuntimeError(
            "Configura CONTROL_SCRIPT_URL + CONTROL_BACKEND_SECRET "
            "o MVSEP_API_TOKEN en Render."
        )


class MvsepClient:
    REGIONS = (
        ("AUTO", "https://mvsep.com/api"),
        ("DE2", "https://de2.mvsep.com/api"),
        ("DE", "https://de.mvsep.com/api"),
        ("SG", "https://sg.mvsep.com/api"),
    )

    def __init__(self, control_client: ControlClient | None = None):
        self.tokens = TokenProvider(control_client)
        self.local = threading.local()

    def session(self):
        s = getattr(self.local, "session", None)
        if s is None:
            s = requests.Session()
            adapter = HTTPAdapter(pool_connections=8, pool_maxsize=8, max_retries=0)
            s.mount("https://", adapter)
            s.mount("http://", adapter)
            s.headers.update({
                "User-Agent": "MVPStudioIA-Render/1.0",
                "Accept": "application/json,text/plain,*/*",
            })
            self.local.session = s
        return s

    @staticmethod
    def classify_remote_url(raw: str):
        try:
            p = urlparse(raw)
        except Exception:
            return None
        if p.scheme not in {"http", "https"}:
            return None
        host = (p.hostname or "").lower().removeprefix("www.")
        if host == "drive.google.com":
            return {"type": "drive", "url": raw}
        if host == "dropbox.com" or host.endswith(".dropbox.com") or host.endswith(".dropboxusercontent.com"):
            return {"type": "dropbox", "url": raw}
        if host in {"mega.nz", "mega.io", "mega.co.nz"} or host.endswith(".mega.nz") or host.endswith(".mega.io") or host.endswith(".mega.co.nz"):
            return {"type": "mega", "url": raw}
        return None

    @staticmethod
    def _message(payload, fallback=""):
        if isinstance(payload, dict):
            data = payload.get("data")
            if isinstance(data, dict) and data.get("message"):
                return str(data["message"])
            if payload.get("message"):
                return str(payload["message"])
            if payload.get("errors"):
                return str(payload["errors"])
        return fallback or "Respuesta no válida del servidor."

    @staticmethod
    def _safe_json(response):
        try:
            return response.json()
        except Exception:
            return None

    @staticmethod
    def _remote_files(files):
        out = []
        if not isinstance(files, list):
            return out
        for i, item in enumerate(files):
            if not isinstance(item, dict):
                continue
            url = str(item.get("url") or "").strip()
            if not url:
                continue
            name = unquote(Path(urlparse(url).path).name) or f"resultado_{i+1}"
            label = str(item.get("name") or item.get("label") or item.get("stem") or name)
            out.append({"url": url, "label": label, "filename": name})
        return out

    def create_from_file(
        self,
        path: str,
        model_id: int,
        output_format: int,
        task_id: str,
        task_update: Callable,
        cancelled: Callable[[], bool],
    ):
        api_token = self.tokens.get()
        size = max(1, os.path.getsize(path))
        filename = Path(path).name
        last_error = None

        for region_name, base in self.REGIONS:
            if cancelled():
                raise RuntimeError("Proceso cancelado.")
            try:
                with open(path, "rb") as fh:
                    encoder = MultipartEncoder(fields={
                        "api_token": api_token,
                        "sep_type": str(model_id),
                        "output_format": str(output_format),
                        "is_demo": "0",
                        "audiofile": (filename, fh, "application/octet-stream"),
                    })
                    started = time.time()

                    def cb(mon):
                        pct = min(99.0, mon.bytes_read / max(1, mon.len) * 100.0)
                        elapsed = max(.25, time.time() - started)
                        speed = mon.bytes_read / elapsed / 1024 / 1024
                        task_update(
                            task_id,
                            status="uploading_mvsep",
                            phase="uploading_mvsep",
                            progress=round(pct, 1),
                            transferred_mb=round(mon.bytes_read / 1024 / 1024, 2),
                            transfer_total_mb=round(mon.len / 1024 / 1024, 2),
                            transfer_speed_mbps=round(speed, 2),
                            message=f"Subiendo a servidor IA · {pct:.0f}% · {speed:.2f} MB/s",
                        )
                        if cancelled():
                            raise RuntimeError("Proceso cancelado.")

                    monitor = MultipartEncoderMonitor(encoder, cb)
                    r = self.session().post(
                        f"{base}/separation/create",
                        data=monitor,
                        headers={"Content-Type": monitor.content_type},
                        timeout=(8, 3600),
                        allow_redirects=True,
                    )
                payload = self._safe_json(r)
                msg = self._message(payload, f"HTTP {r.status_code}")
                if r.status_code in (401, 429) or "invalid token" in msg.lower():
                    api_token = self.tokens.get()
                    last_error = msg
                    continue
                if r.status_code >= 500:
                    last_error = msg
                    continue
                if r.status_code >= 400 or not isinstance(payload, dict) or payload.get("success") is not True:
                    last_error = msg
                    continue
                data = payload.get("data") or {}
                h = str(data.get("hash") or "").strip()
                if not h:
                    last_error = "El servidor no devolvió hash."
                    continue
                job = {
                    "hash": h,
                    "api_token": api_token,
                    "region_name": region_name,
                    "api_base": base,
                    "status_link": str(data.get("link") or ""),
                }
                task_update(task_id, remote_job=job, status="waiting", progress=None,
                            message="Audio recibido. Consultando cola real…")
                return job
            except Exception as exc:
                last_error = exc
                if cancelled():
                    raise RuntimeError("Proceso cancelado.")
                continue
        raise RuntimeError(f"No se pudo crear el trabajo en MVSep: {last_error}")

    def create_from_link(
        self,
        url: str,
        remote_type: str,
        model_id: int,
        output_format: int,
        task_id: str,
        task_update: Callable,
        cancelled: Callable[[], bool],
    ):
        api_token = self.tokens.get()
        last_error = None
        for region_name, base in self.REGIONS:
            if cancelled():
                raise RuntimeError("Proceso cancelado.")
            try:
                r = self.session().post(
                    f"{base}/separation/create",
                    data={
                        "api_token": api_token,
                        "url": url,
                        "remote_type": remote_type,
                        "sep_type": str(model_id),
                        "output_format": str(output_format),
                        "is_demo": "0",
                    },
                    timeout=(8, 90),
                    allow_redirects=True,
                )
                payload = self._safe_json(r)
                msg = self._message(payload, f"HTTP {r.status_code}")
                if r.status_code in (401, 429) or "invalid token" in msg.lower():
                    api_token = self.tokens.get()
                    last_error = msg
                    continue
                if r.status_code >= 500:
                    last_error = msg
                    continue
                if r.status_code >= 400 or not isinstance(payload, dict) or payload.get("success") is not True:
                    last_error = msg
                    continue
                data = payload.get("data") or {}
                h = str(data.get("hash") or "").strip()
                if not h:
                    last_error = "El servidor no devolvió hash."
                    continue
                job = {
                    "hash": h,
                    "api_token": api_token,
                    "region_name": region_name,
                    "api_base": base,
                    "status_link": str(data.get("link") or ""),
                }
                task_update(task_id, remote_job=job, status="waiting", message="Enlace recibido. Consultando cola real…")
                return job
            except Exception as exc:
                last_error = exc
                continue
        raise RuntimeError(f"No se pudo crear el trabajo remoto: {last_error}")

    def _queue_summary(self, token):
        try:
            r = self.session().get(
                "https://mvsep.com/api/app/queue/summary",
                params={"api_token": token},
                timeout=(6, 12),
            )
            if r.ok:
                data = r.json()
                return data if isinstance(data, dict) else {}
        except Exception:
            pass
        return {}

    def wait_for_result(self, job, task_id, task_update, cancelled):
        last_queue = 0.0
        queue_summary = {}
        not_found = 0
        while True:
            if cancelled():
                self.cancel(job)
                raise RuntimeError("Proceso cancelado.")

            payload = None
            candidates = []
            status_link = str(job.get("status_link") or "")
            if status_link.startswith("http"):
                candidates.append((status_link, None))
            candidates.append((f"{job['api_base']}/separation/get", {"hash": job["hash"]}))
            for _, base in self.REGIONS:
                u = f"{base}/separation/get"
                if all(c[0] != u for c in candidates):
                    candidates.append((u, {"hash": job["hash"]}))

            for url, params in candidates:
                try:
                    r = self.session().get(url, params=params, timeout=(8, 25), allow_redirects=True)
                    if r.status_code == 429 or r.status_code >= 500:
                        continue
                    p = self._safe_json(r)
                    if isinstance(p, dict):
                        payload = p
                        if p.get("success") is True:
                            break
                        if str(p.get("status") or "").lower() == "not_found":
                            not_found += 1
                except Exception:
                    continue

            if not isinstance(payload, dict) or payload.get("success") is not True:
                if not_found > 12:
                    raise RuntimeError("El trabajo ya no está disponible en el servidor.")
                task_update(task_id, status="reconnecting", message="Reconectando con el servidor IA…")
                time.sleep(4)
                continue

            status = str(payload.get("status") or "").lower()
            data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
            queue_count = int(data.get("queue_count") or 0)
            current_order = int(data.get("current_order") or 0)
            finished_chunks = int(data.get("finished_chunks") or 0)
            all_chunks = int(data.get("all_chunks") or 0)

            if status in {"waiting", "distributing"} and time.time() - last_queue > 4:
                queue_summary = self._queue_summary(job.get("api_token", ""))
                last_queue = time.time()

            common = dict(
                remote_status=status,
                queue_count=queue_count,
                queue_position=current_order,
                queue_ahead=int(queue_summary.get("ahead") or 0),
                estimated_wait_seconds=queue_summary.get("estimated_wait_seconds"),
                finished_chunks=finished_chunks,
                all_chunks=all_chunks,
                server_message=str(data.get("message") or ""),
            )

            if status == "waiting":
                msg = f"En cola · posición {current_order}." if current_order else "Trabajo recibido. En cola."
                task_update(task_id, status="waiting", phase="waiting", progress=None, message=msg, **common)
            elif status == "processing":
                task_update(task_id, status="processing", phase="processing", progress=None,
                            message="Procesando audio en servidor IA…", **common)
            elif status == "distributing":
                chunks = f" · {finished_chunks}/{all_chunks} bloques" if all_chunks else ""
                task_update(task_id, status="distributing", phase="distributing", progress=None,
                            message=f"Procesando por bloques{chunks}…", **common)
            elif status == "merging":
                task_update(task_id, status="merging", phase="merging", progress=None,
                            message="Uniendo resultados en servidor IA…", **common)
            elif status == "done":
                files = self._remote_files(data.get("files") or [])
                task_update(task_id, status="done", phase="done", progress=100.0,
                            message="Pistas listas.", files=files, remote_job=None, **common)
                return
            elif status == "failed":
                raise RuntimeError(self._message(payload, "El procesamiento remoto falló."))
            else:
                task_update(task_id, status=status or "processing", progress=None,
                            message=str(data.get("message") or "Servidor trabajando…"), **common)

            time.sleep(2.0)

    def cancel(self, job):
        if not job:
            return
        try:
            self.session().post(
                "https://mvsep.com/api/separation/cancel",
                data={"api_token": job.get("api_token", ""), "hash": job.get("hash", "")},
                timeout=(6, 15),
            )
        except Exception:
            pass
