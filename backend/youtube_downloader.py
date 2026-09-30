from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import Callable

BGUTIL_HOME = os.getenv(
    "BGUTIL_HOME",
    "/opt/bgutil-ytdlp-pot-provider",
).strip()

YOUTUBE_COOKIE_FILE = os.getenv(
    "YOUTUBE_COOKIE_FILE",
    "/etc/secrets/youtube_cookies.txt",
).strip()


def _cookie_file() -> str:
    candidates = [
        YOUTUBE_COOKIE_FILE,
        "/etc/secrets/youtube_cookies.txt",
        "/etc/secrets/cookies.txt",
    ]
    for raw in candidates:
        if not raw:
            continue
        p = Path(raw)
        if not p.is_file():
            continue
        try:
            lines = p.read_text(
                encoding="utf-8", errors="ignore"
            ).splitlines()
            first = lines[0].strip() if lines else ""
        except Exception:
            continue
        if first in (
            "# Netscape HTTP Cookie File",
            "# HTTP Cookie File",
        ):
            return str(p)
    return ""


def _deno_runtime() -> str:
    for p in (
        shutil.which("deno"),
        "/usr/local/bin/deno",
        "/usr/local/deno/bin/deno",
    ):
        if p and Path(p).exists():
            return str(p)
    return ""


def _yt_dlp_cli() -> str:
    return shutil.which("yt-dlp") or ""


def _provider_home() -> str:
    p = Path(BGUTIL_HOME) / "server"
    return str(p) if p.is_dir() else ""


def _base_args(use_cookies: bool = False) -> list[str]:
    deno = _deno_runtime()
    if not deno:
        raise RuntimeError(
            "Deno no está instalado en Render. "
            "Haz Clear build cache & deploy."
        )

    args = [
        "--no-playlist",
        "--no-check-certificates",
        "--no-cache-dir",
        "--retries", "3",
        "--fragment-retries", "3",
        "--extractor-retries", "3",
        "--socket-timeout", "25",
        "--js-runtimes", f"deno:{deno}",
        "--remote-components", "ejs:npm",
    ]

    if use_cookies:
        cookie = _cookie_file()
        if cookie:
            args += ["--cookies", cookie]

    return args


def _profile_args(
    client: str,
    use_pot: bool,
    use_cookies: bool,
) -> list[str]:
    args = _base_args(use_cookies=use_cookies)
    args += [
        "--extractor-args",
        f"youtube:player-client={client}",
    ]

    if use_pot:
        provider = _provider_home()
        if not provider:
            raise RuntimeError(
                "BgUtils PO Token Provider no está instalado. "
                "Haz Clear build cache & deploy en Render."
            )
        args += [
            "--extractor-args",
            f"youtubepot-bgutilscript:server_home={provider}",
        ]

    return args


# Orden intencional:
# 1. mweb + PO token sin cuenta.
# 2. mweb + PO token + cookies si YouTube aún exige sesión.
# 3. web_safari como respaldo.
# 4. web_embedded para videos que permiten embed.
PROFILES = (
    ("mweb-pot", "mweb", True, False),
    ("mweb-pot-cookies", "mweb", True, True),
    ("web-safari", "web_safari", False, False),
    ("web-embedded", "web_embedded", False, False),
)


def _is_definitive_error(text: str) -> bool:
    t = (text or "").lower()
    return any(x in t for x in (
        "private video",
        "video unavailable",
        "this video is unavailable",
        "video has been removed",
        "members-only content",
        "members only content",
        "sign in to confirm your age",
        "unsupported url",
    ))


def _friendly_error(text: str) -> str:
    t = (text or "").lower()

    if "failed to extract any player response" in t:
        return (
            "YouTube no entregó una respuesta de reproducción al servidor. "
            "Se intentó PO Token, Deno/EJS y perfiles alternativos. "
            "Si persiste, la IP de Render puede estar bloqueada por YouTube."
        )

    if "sign in to confirm you" in t and "not a bot" in t:
        if _cookie_file():
            return (
                "YouTube sigue rechazando la IP/sesión del servidor aunque "
                "youtube_cookies.txt está instalado. Puede ser un bloqueo "
                "de la IP de Render."
            )
        return (
            "YouTube solicita autenticación al servidor. "
            "Agrega youtube_cookies.txt como Secret File en Render."
        )

    if "po token" in t or "pot" in t:
        return (
            "No se pudo obtener el PO Token de YouTube. "
            "Verifica que el despliegue haya instalado BgUtils correctamente."
        )

    return text[-1200:]


def _run_probe_profile(
    url: str,
    client: str,
    use_pot: bool,
    use_cookies: bool,
):
    exe = _yt_dlp_cli()
    if not exe:
        raise RuntimeError("yt-dlp CLI no está instalado.")

    cmd = [
        exe,
        *_profile_args(client, use_pot, use_cookies),
        "--skip-download",
        "--dump-single-json",
        "--no-warnings",
        url,
    ]

    p = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )

    if p.returncode != 0:
        raise RuntimeError(
            (p.stderr or p.stdout or "Error de YouTube")[-2400:]
        )

    raw = (p.stdout or "").strip()
    for line in reversed(raw.splitlines()):
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            return json.loads(line)
        except Exception:
            continue

    try:
        return json.loads(raw)
    except Exception:
        raise RuntimeError(
            "yt-dlp no devolvió información JSON del video."
        )


def probe_youtube(url: str):
    errors = []

    for name, client, use_pot, use_cookies in PROFILES:
        # Si el perfil depende de cookies y no existen, lo saltamos.
        if use_cookies and not _cookie_file():
            continue

        try:
            info = _run_probe_profile(
                url,
                client=client,
                use_pot=use_pot,
                use_cookies=use_cookies,
            )

            if info.get("_type") == "playlist":
                entries = [
                    x for x in (info.get("entries") or []) if x
                ]
                if not entries:
                    raise RuntimeError(
                        "No se encontró un video descargable."
                    )
                info = entries[0]

            return {
                "title": info.get("title") or "YouTube",
                "duration": info.get("duration") or 0,
                "profile": name,
            }
        except Exception as exc:
            msg = str(exc)
            errors.append(f"{name}: {msg}")
            if _is_definitive_error(msg):
                raise RuntimeError(_friendly_error(msg))

    last = errors[-1] if errors else "Sin respuesta."
    raise RuntimeError(
        "No se pudo leer el video de YouTube. "
        f"Detalle: {_friendly_error(last)}"
    )


def _parse_pct(line: str):
    if "__MVP_PROGRESS__=" not in line:
        return None
    value = (
        line.split("__MVP_PROGRESS__=", 1)[1]
        .replace("%", "")
        .strip()
    )
    m = re.search(r"(\d+(?:\.\d+)?)", value)
    return float(m.group(1)) if m else None


def _download_profile(
    url: str,
    output_dir: Path,
    progress: Callable,
    cancelled: Callable[[], bool],
    name: str,
    client: str,
    use_pot: bool,
    use_cookies: bool,
):
    exe = _yt_dlp_cli()
    if not exe:
        raise RuntimeError("yt-dlp CLI no está instalado.")

    out = str(
        output_dir / "%(title).160B [%(id)s].%(ext)s"
    )

    cmd = [
        exe,
        *_profile_args(client, use_pot, use_cookies),
        "--quiet",
        "--no-warnings",
        "--restrict-filenames",
        "--newline",
        "--progress",
        "--no-colors",
        "--progress-template",
        "download:__MVP_PROGRESS__=%(progress._percent_str)s",
        "-f", "bestaudio/best",
        "-o", out,
        "--print",
        "after_move:__MVP_PATH__=%(filepath)s",
        "--print",
        "after_move:__MVP_TITLE__=%(title)s",
        url,
    ]

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )

    path = ""
    title = ""
    lines = []

    try:
        assert proc.stdout is not None
        for raw in proc.stdout:
            if cancelled():
                proc.terminate()
                raise RuntimeError("Proceso cancelado.")

            line = raw.rstrip()
            lines.append(line)

            pct = _parse_pct(line)
            if pct is not None:
                progress(
                    min(99.0, pct),
                    f"Descargando YouTube · {pct:.0f}%",
                )
            elif line.startswith("__MVP_PATH__="):
                path = line.split("=", 1)[1].strip()
            elif line.startswith("__MVP_TITLE__="):
                title = line.split("=", 1)[1].strip()

        code = proc.wait(timeout=1200)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass
        raise

    if code == 0 and path and Path(path).exists():
        progress(100.0, "Audio de YouTube listo.")
        return {
            "file_path": path,
            "title": title or Path(path).stem,
            "profile": name,
        }

    raise RuntimeError("\n".join(lines)[-2400:])


def download_youtube(
    url: str,
    output_dir: Path,
    progress: Callable,
    cancelled: Callable[[], bool],
):
    output_dir.mkdir(parents=True, exist_ok=True)
    errors = []

    for name, client, use_pot, use_cookies in PROFILES:
        if use_cookies and not _cookie_file():
            continue
        if cancelled():
            raise RuntimeError("Proceso cancelado.")

        try:
            return _download_profile(
                url=url,
                output_dir=output_dir,
                progress=progress,
                cancelled=cancelled,
                name=name,
                client=client,
                use_pot=use_pot,
                use_cookies=use_cookies,
            )
        except Exception as exc:
            msg = str(exc)
            errors.append(f"{name}: {msg}")
            if _is_definitive_error(msg):
                raise RuntimeError(_friendly_error(msg))
            time.sleep(0.6)

    last = errors[-1] if errors else "Sin respuesta."
    raise RuntimeError(
        "No se pudo descargar el audio de YouTube. "
        f"Detalle: {_friendly_error(last)}"
    )
