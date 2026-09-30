from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

COOKIE_NAME = "mvp_session"
SESSION_DAYS = max(1, int(os.getenv("SESSION_DAYS", "90")))


def _secret() -> bytes:
    value = (
        os.getenv("SESSION_SECRET", "").strip()
        or os.getenv("CONTROL_BACKEND_SECRET", "").strip()
    )
    if len(value) < 24:
        raise RuntimeError(
            "Configura SESSION_SECRET con una clave aleatoria larga en Render."
        )
    return value.encode("utf-8")


def _b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64d(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def create_session(user: dict[str, Any]) -> tuple[str, int]:
    now = int(time.time())
    max_age = SESSION_DAYS * 24 * 60 * 60
    payload = {
        "v": 1,
        "sub": str(user.get("usuario") or "").strip().lower(),
        "uid": str(user.get("id") or ""),
        "plan": str(user.get("plan") or "PRO"),
        "iat": now,
        "exp": now + max_age,
        "jti": secrets.token_hex(8),
    }
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    body = _b64e(raw)
    sig = hmac.new(_secret(), body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{_b64e(sig)}", max_age


def parse_session(token: str) -> dict[str, Any] | None:
    try:
        body, sig = token.split(".", 1)
        expected = hmac.new(_secret(), body.encode("ascii"), hashlib.sha256).digest()
        supplied = _b64d(sig)
        if not hmac.compare_digest(expected, supplied):
            return None
        payload = json.loads(_b64d(body).decode("utf-8"))
        if not isinstance(payload, dict):
            return None
        if int(payload.get("exp") or 0) <= int(time.time()):
            return None
        username = str(payload.get("sub") or "").strip().lower()
        if not username:
            return None
        return payload
    except Exception:
        return None
