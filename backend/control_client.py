from __future__ import annotations

import os
import threading
import time
from typing import Any

import requests
from requests.adapters import HTTPAdapter


class ControlClient:
    """Cliente privado para el único Google Apps Script de MVP Studio IA."""

    def __init__(self):
        self.url = os.getenv("CONTROL_SCRIPT_URL", "").strip()
        self.backend_secret = os.getenv("CONTROL_BACKEND_SECRET", "").strip()
        self.local = threading.local()

    def configured(self) -> bool:
        return bool(self.url and self.backend_secret)

    def session(self) -> requests.Session:
        session = getattr(self.local, "session", None)
        if session is None:
            session = requests.Session()
            adapter = HTTPAdapter(pool_connections=4, pool_maxsize=4, max_retries=0)
            session.mount("https://", adapter)
            session.mount("http://", adapter)
            session.headers.update({
                "User-Agent": "MVPStudioIA-Control/2.0",
                "Accept": "application/json,text/plain,*/*",
            })
            self.local.session = session
        return session

    def _post(self, action: str, **payload: Any) -> dict:
        if not self.configured():
            raise RuntimeError(
                "Falta configurar CONTROL_SCRIPT_URL y CONTROL_BACKEND_SECRET en Render."
            )

        body = {
            "accion": action,
            "backend_secret": self.backend_secret,
            **payload,
        }

        last_error: Exception | None = None
        for attempt in range(3):
            try:
                response = self.session().post(
                    self.url,
                    json=body,
                    timeout=(6, 20),
                    allow_redirects=True,
                )
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, dict):
                    raise RuntimeError("El Apps Script devolvió una respuesta inválida.")
                return data
            except Exception as exc:
                last_error = exc
                if attempt < 2:
                    time.sleep(0.8 * (attempt + 1))

        raise RuntimeError(f"No se pudo conectar con el control de usuarios: {last_error}")

    def login(self, username: str, password: str) -> dict:
        data = self._post("login", usuario=username, password=password)
        if data.get("success") is not True:
            raise PermissionError(str(data.get("message") or "Usuario o contraseña incorrectos."))
        user = data.get("user")
        if not isinstance(user, dict):
            raise RuntimeError("El servidor de usuarios no devolvió el perfil.")
        return user

    def validate_user(self, username: str) -> dict:
        data = self._post("validar_usuario", usuario=username)
        if data.get("success") is not True:
            raise PermissionError(str(data.get("message") or "El usuario no está habilitado."))
        user = data.get("user")
        if not isinstance(user, dict):
            raise RuntimeError("El servidor de usuarios no devolvió el perfil.")
        return user

    def get_api_key(self) -> str:
        data = self._post("get_api_key")
        key = str(data.get("api_key") or "").strip()
        if data.get("success") is not True or not key:
            raise RuntimeError(str(data.get("message") or "No hay APIs disponibles."))
        return key
