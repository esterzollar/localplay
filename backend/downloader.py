"""
downloader.py — yt-dlp wrapper with quality selection, caption support, and download history.
"""

import threading
import uuid
import yt_dlp
from typing import Optional
from datetime import datetime, timezone
from .config import get_ytdlp_base_opts, BASE_DIR

# ── Quality format strings ─────────────────────────────────────────────────

QUALITY_FORMATS = {
    "best":  "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    "1080p": "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    "720p":  "bestvideo[height<=720]+bestaudio/best[height<=720]",
    "480p":  "bestvideo[height<=480]+bestaudio/best[height<=480]",
    "360p":  "bestvideo[height<=360]+bestaudio/best[height<=360]",
}


class DownloadManager:
    def __init__(self):
        self._active: dict[str, dict] = {}
        self._history: list[dict] = []   # last 100 completed / failed
        self._lock = threading.Lock()
        
        # Load persistent history
        self.history_file = BASE_DIR / "backend" / "download_history.json"
        if self.history_file.exists():
            try:
                import json
                with open(self.history_file, "r", encoding="utf-8") as f:
                    self._history = json.load(f)
            except Exception:
                pass

    def _save_history(self):
        try:
            import json
            with open(self.history_file, "w", encoding="utf-8") as f:
                json.dump(self._history, f, indent=2)
        except Exception:
            pass

    # ── Progress hook ──────────────────────────────────────────────────────

    def _progress_hook(self, d: dict, download_id: str):
        with self._lock:
            entry = self._active.get(download_id)
            if not entry:
                return
            status = d.get("status")
            if status == "downloading":
                entry.update({
                    "status": "downloading",
                    "percent_str": d.get("_percent_str", "0%").strip(),
                    "speed_str":   d.get("_speed_str",   "–").strip(),
                    "eta_str":     d.get("_eta_str",     "–").strip(),
                    "filename":    d.get("filename", entry.get("filename", "")),
                })
            elif status == "finished":
                entry["status"] = "processing"
            elif status == "error":
                entry["status"] = "error"

    # ── Public read ────────────────────────────────────────────────────────

    def get_progress(self) -> dict:
        with self._lock:
            return self._active.copy()

    def get_history(self) -> list:
        with self._lock:
            return list(reversed(self._history))

    def get_download(self, download_id: str) -> Optional[dict]:
        with self._lock:
            return self._active.get(download_id)

    # ── Download ───────────────────────────────────────────────────────────

    def download(self, url: str, quality: str = "best", captions: bool = False, download_id: Optional[str] = None) -> tuple[str, dict]:
        """
        Start a download synchronously (must be run in a thread / asyncio.to_thread).
        Returns (download_id, info_dict).
        """
        if not download_id:
            download_id = str(uuid.uuid4())
        started_at = datetime.now(timezone.utc).isoformat()

        with self._lock:
            if download_id in self._active:
                entry = self._active[download_id]
                entry.update({
                    "quality": quality,
                    "captions": captions,
                })
            else:
                entry = {
                    "download_id":  download_id,
                    "url":          url,
                    "status":       "starting",
                    "percent_str":  "0%",
                    "speed_str":    "–",
                    "eta_str":      "–",
                    "filename":     "",
                    "title":        "",
                    "channel":      "",
                    "quality":      quality,
                    "captions":     captions,
                    "started_at":   started_at,
                    "finished_at":  None,
                    "error":        None,
                }
                self._active[download_id] = entry

        opts = get_ytdlp_base_opts()
        opts["format"] = QUALITY_FORMATS.get(quality, QUALITY_FORMATS["best"])
        opts["progress_hooks"] = [lambda d: self._progress_hook(d, download_id)]

        if captions:
            opts["writesubtitles"]    = True
            opts["writeautomaticsub"] = True
            opts["subtitleslangs"]    = ["en"]
            opts["subtitlesformat"]   = "vtt"

        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)
            finished_at = datetime.now(timezone.utc).isoformat()
            with self._lock:
                entry["status"]      = "done"
                entry["finished_at"] = finished_at
                entry["title"]       = info.get("title", "")
                entry["channel"]     = info.get("channel") or info.get("uploader", "")
                self._history.append(dict(entry))
                if len(self._history) > 100:
                    self._history.pop(0)
                self._save_history()
            return download_id, info
        except Exception as exc:
            finished_at = datetime.now(timezone.utc).isoformat()
            with self._lock:
                entry["status"]      = "error"
                entry["finished_at"] = finished_at
                entry["error"]       = str(exc)
                self._history.append(dict(entry))
                if len(self._history) > 100:
                    self._history.pop(0)
                self._save_history()
            raise


# ── Singleton ──────────────────────────────────────────────────────────────

manager = DownloadManager()
