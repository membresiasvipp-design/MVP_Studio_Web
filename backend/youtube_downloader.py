from __future__ import annotations

import json
import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import Callable

import yt_dlp


def _is_final_error(text: str) -> bool:
    t = (text or "").lower()
    return any(x in t for x in (
        "unsupported url",
        "private video",
        "video unavailable",
        "this video is unavailable",
        "video has been removed",
        "members-only content",
        "members only content",
        "sign in to confirm your age",
    ))


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


def _common_cli_args() -> list[str]:
    deno = _deno_runtime()
    if not deno:
        raise RuntimeError(
            "Deno no está disponible en el servidor. "
            "Realiza un Clear build cache & deploy en Render."
        )
    return [
        "--no-playlist",
        "--no-check-certificates",
        "--no-cache-dir",
        "--retries", "3",
        "--fragment-retries", "3",
        "--extractor-retries", "3",
        "--socket-timeout", "25",
        "--js-runtimes", f"deno:{deno}",
    ]


def _run_probe_cli(url: str, remote_component: str | None):
    exe = _yt_dlp_cli()
    if not exe:
        raise RuntimeError("yt-dlp CLI no está disponible.")

    cmd = [
        exe,
        *_common_cli_args(),
        "--skip-download",
        "--dump-single-json",
        "--no-warnings",
    ]
    if remote_component:
        cmd += ["--remote-components", remote_component]
    cmd.append(url)

    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=90,
    )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "Error de yt-dlp")[-1800:])

    raw = (proc.stdout or "").strip()
    if not raw:
        raise RuntimeError("YouTube no devolvió información del video.")
    # yt-dlp puede imprimir líneas previas; usamos la última línea JSON válida.
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
    except Exception as exc:
        raise RuntimeError(f"No se pudo interpretar la información de YouTube: {exc}")


def probe_youtube(url: str):
    last_error = ""
    # 1) EJS instalado con yt-dlp[default], 2) npm remoto como respaldo,
    # 3) GitHub remoto como último respaldo.
    for remote in (None, "ejs:npm", "ejs:github"):
        try:
            info = _run_probe_cli(url, remote)
            if info.get("_type") == "playlist":
                entries = [x for x in (info.get("entries") or []) if x]
                if not entries:
                    raise RuntimeError("No se encontró un video descargable.")
                info = entries[0]
            return {
                "title": info.get("title") or "YouTube",
                "duration": info.get("duration") or 0,
            }
        except Exception as exc:
            last_error = str(exc)
            if _is_final_error(last_error):
                raise RuntimeError(last_error)

    # Fallback API Python usando Deno
    deno = _deno_runtime()
    if deno:
        try:
            opts = {
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                "nocheckcertificate": True,
                "socket_timeout": 25,
                "skip_download": True,
                "cachedir": False,
                "js_runtimes": {"deno": {"path": deno}},
                "remote_components": {"ejs:npm"},
            }
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
            if info:
                return {
                    "title": info.get("title") or "YouTube",
                    "duration": info.get("duration") or 0,
                }
        except Exception as exc:
            last_error = str(exc)

    raise RuntimeError(
        "No se pudo leer el video de YouTube. "
        f"Detalle: {last_error[-900:]}"
    )


def _parse_pct(line: str):
    if "__MVP_PROGRESS__=" not in line:
        return None
    value = line.split("__MVP_PROGRESS__=", 1)[1].replace("%", "").strip()
    m = re.search(r"(\d+(?:\.\d+)?)", value)
    return float(m.group(1)) if m else None


def _download_cli(
    url: str,
    output_dir: Path,
    progress: Callable,
    cancelled: Callable[[], bool],
):
    exe = _yt_dlp_cli()
    if not exe:
        return None, "yt-dlp CLI no disponible", False

    last_error = ""
    for remote in (None, "ejs:npm", "ejs:github"):
        if cancelled():
            raise RuntimeError("Proceso cancelado.")

        out = str(output_dir / "%(title).160B [%(id)s].%(ext)s")
        cmd = [
            exe,
            *_common_cli_args(),
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
        ]
        if remote:
            cmd += ["--remote-components", remote]
        cmd += [
            "--print", "after_move:__MVP_PATH__=%(filepath)s",
            "--print", "after_move:__MVP_TITLE__=%(title)s",
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
        lines = []
        path = ""
        title = ""

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
            }, "", False

        last_error = "\n".join(lines)[-1800:]
        if _is_final_error(last_error):
            return None, last_error, True
        time.sleep(0.5)

    return None, last_error, False


def _download_python(
    url: str,
    output_dir: Path,
    progress: Callable,
    cancelled: Callable[[], bool],
):
    deno = _deno_runtime()
    if not deno:
        raise RuntimeError("Deno no está disponible en Render.")

    def hook(d):
        if cancelled():
            raise RuntimeError("Proceso cancelado.")
        if d.get("status") == "downloading":
            done = d.get("downloaded_bytes") or 0
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            if total:
                pct = min(99.0, done / total * 100.0)
                speed = d.get("speed") or 0
                speed_text = f"{speed/1024/1024:.2f} MB/s" if speed else ""
                progress(
                    pct,
                    f"Descargando YouTube · {pct:.0f}%",
                    speed_text,
                )

    opts = {
        "outtmpl": str(output_dir / "%(title).160B [%(id)s].%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "restrictfilenames": True,
        "nocheckcertificate": True,
        "cachedir": False,
        "retries": 3,
        "fragment_retries": 3,
        "extractor_retries": 3,
        "socket_timeout": 25,
        "format": "bestaudio/best",
        "progress_hooks": [hook],
        "js_runtimes": {"deno": {"path": deno}},
        "remote_components": {"ejs:npm"},
    }

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info.get("_type") == "playlist":
                info = next((x for x in (info.get("entries") or []) if x), None)
            if not info:
                raise RuntimeError("No se obtuvo información del video.")

            prepared = Path(ydl.prepare_filename(info))
            candidates = [
                p for p in prepared.parent.glob(prepared.stem + ".*")
                if p.suffix.lower() not in {".part", ".ytdl", ".json"}
            ]
            if not candidates:
                raise RuntimeError(
                    "La descarga terminó pero no se encontró el archivo."
                )

            final = max(candidates, key=lambda p: p.stat().st_mtime)
            progress(100.0, "Audio de YouTube listo.")
            return {
                "file_path": str(final),
                "title": info.get("title") or final.stem,
            }
    except Exception as exc:
        raise RuntimeError(str(exc))


def download_youtube(
    url: str,
    output_dir: Path,
    progress: Callable,
    cancelled: Callable[[], bool],
):
    output_dir.mkdir(parents=True, exist_ok=True)

    result, error, definitive = _download_cli(
        url, output_dir, progress, cancelled
    )
    if result:
        return result
    if definitive:
        raise RuntimeError(error)

    return _download_python(
        url, output_dir, progress, cancelled
    )
