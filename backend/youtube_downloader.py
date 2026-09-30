from __future__ import annotations

import os
import re
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
    ))


def _profiles():
    return [
        ("default", None, None),
        (
            "default_sin_android_sdkless",
            {"youtube": {"player_client": ["default", "-android_sdkless"]}},
            "youtube:player_client=default,-android_sdkless",
        ),
        (
            "mweb_pot",
            {"youtube": {"player_client": ["mweb"]}},
            "youtube:player_client=mweb",
        ),
    ]


def _node_runtime():
    for p in ("/usr/bin/node", "/usr/local/bin/node"):
        if Path(p).exists():
            return p
    return ""


def probe_youtube(url: str):
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "nocheckcertificate": True,
        "socket_timeout": 20,
        "skip_download": True,
        "cachedir": False,
    }
    node = _node_runtime()
    if node:
        opts["js_runtimes"] = {"node": {"path": node}}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    if not info:
        raise RuntimeError("YouTube no devolvió información del video.")
    if info.get("_type") == "playlist":
        entries = [x for x in (info.get("entries") or []) if x]
        if not entries:
            raise RuntimeError("No se encontró un video descargable.")
        info = entries[0]
    return {
        "title": info.get("title") or "YouTube",
        "duration": info.get("duration") or 0,
    }


def _parse_pct(line: str):
    if "__MVP_PROGRESS__=" not in line:
        return None
    value = line.split("__MVP_PROGRESS__=", 1)[1].replace("%", "").strip()
    m = re.search(r"(\d+(?:\.\d+)?)", value)
    return float(m.group(1)) if m else None


def _download_cli(url: str, output_dir: Path, progress: Callable, cancelled: Callable[[], bool]):
    exe = shutil_which("yt-dlp")
    if not exe:
        return None, "yt-dlp CLI no disponible", False

    node = _node_runtime()
    last_error = ""
    for name, _, extractor_cli in _profiles():
        if cancelled():
            raise RuntimeError("Proceso cancelado.")
        out = str(output_dir / "%(title).160B [%(id)s].%(ext)s")
        cmd = [
            exe, "--no-playlist", "--quiet", "--no-warnings", "--no-check-certificates",
            "--no-cache-dir", "--restrict-filenames",
            "--retries", "3", "--fragment-retries", "3", "--extractor-retries", "2",
            "--socket-timeout", "20", "--newline", "--progress", "--no-colors",
            "--progress-template", "download:__MVP_PROGRESS__=%(progress._percent_str)s",
            "-f", "bestaudio/best",
            "-o", out,
        ]
        if node:
            cmd += ["--js-runtimes", f"node:{node}"]
        if extractor_cli:
            cmd += ["--extractor-args", extractor_cli]
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
                    progress(min(99.0, pct), f"Descargando YouTube · {pct:.0f}%")
                elif line.startswith("__MVP_PATH__="):
                    path = line.split("=", 1)[1].strip()
                elif line.startswith("__MVP_TITLE__="):
                    title = line.split("=", 1)[1].strip()
            code = proc.wait(timeout=1800)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
            raise
        if code == 0 and path and Path(path).exists():
            progress(100.0, "Audio de YouTube listo.")
            return {"file_path": path, "title": title or Path(path).stem}, "", False
        last_error = "\n".join(lines)[-1400:]
        if _is_final_error(last_error):
            return None, last_error, True
        time.sleep(.5)
    return None, last_error, False


def shutil_which(name):
    import shutil
    return shutil.which(name)


def _download_python(url: str, output_dir: Path, progress: Callable, cancelled: Callable[[], bool]):
    last_error = ""
    node = _node_runtime()

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
                progress(pct, f"Descargando YouTube · {pct:.0f}%", speed_text)

    for name, extractor_args, _ in _profiles():
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
            "extractor_retries": 2,
            "socket_timeout": 20,
            "format": "bestaudio/best",
            "progress_hooks": [hook],
        }
        if node:
            opts["js_runtimes"] = {"node": {"path": node}}
        if extractor_args:
            opts["extractor_args"] = extractor_args
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
                    raise RuntimeError("La descarga terminó pero no se encontró el archivo.")
                final = max(candidates, key=lambda p: p.stat().st_mtime)
                progress(100.0, "Audio de YouTube listo.")
                return {"file_path": str(final), "title": info.get("title") or final.stem}
        except Exception as exc:
            last_error = str(exc)
            if _is_final_error(last_error):
                raise RuntimeError(last_error)
    raise RuntimeError(last_error or "No se pudo descargar el audio de YouTube.")


def download_youtube(url: str, output_dir: Path, progress: Callable, cancelled: Callable[[], bool]):
    output_dir.mkdir(parents=True, exist_ok=True)
    result, error, definitive = _download_cli(url, output_dir, progress, cancelled)
    if result:
        return result
    if definitive:
        raise RuntimeError(error)
    return _download_python(url, output_dir, progress, cancelled)
