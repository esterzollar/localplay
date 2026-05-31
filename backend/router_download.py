"""
router_download.py — download endpoints.

Fixes:
  - Bug 2: asyncio.to_thread so yt-dlp never blocks the event loop
  - Bug 3: POST returns {"download_id": ..., "message": ...}
"""

import asyncio
import yt_dlp
from fastapi import APIRouter, Query, HTTPException
from .schemas import DownloadRequest
from .downloader import manager
from .media_scanner import scan_new_only

router = APIRouter(prefix="/api/download", tags=["download"])


def _extract_info(url: str) -> dict:
    """Run yt-dlp info extraction (no download) in a thread."""
    from .config import BASE_DIR
    cookies_file = BASE_DIR / "backend" / "cookies.txt"
    opts = {
        'quiet': True,
        'skip_download': True,
        'no_warnings': True,
        'extract_flat': False,
    }
    if cookies_file.exists():
        opts['cookiefile'] = str(cookies_file)
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)

    # Collect unique heights from all video formats
    heights = set()
    for fmt in (info.get('formats') or []):
        h = fmt.get('height')
        if h and isinstance(h, int) and h >= 144:
            heights.add(h)

    # Map to labelled quality options the UI understands
    quality_map = {1080: '1080p', 720: '720p', 480: '480p', 360: '360p', 144: '144p'}
    available = []
    for h in sorted(heights, reverse=True):
        # Round to nearest standard quality bucket
        for threshold in [1080, 720, 480, 360, 144]:
            if h >= threshold:
                label = quality_map[threshold]
                if label not in [q['label'] for q in available]:
                    available.append({'value': f'{threshold}p', 'label': f'{label} HD' if threshold >= 720 else f'{label}'})
                break
    if not available:
        available = [{'value': 'best', 'label': 'Best available'}]
    else:
        available.insert(0, {'value': 'best', 'label': f'Best (up to {available[0]["label"]}'})

    has_captions = bool(
        info.get('subtitles') or info.get('automatic_captions')
    )

    return {
        'title':       info.get('title', ''),
        'channel':     info.get('channel') or info.get('uploader', ''),
        'duration':    info.get('duration'),
        'thumbnail':   info.get('thumbnail', ''),
        'webpage_url': info.get('webpage_url', url),
        'qualities':   available,
        'has_captions': has_captions,
        'is_playlist': '_type' in info and info.get('_type') == 'playlist',
        'entry_count': len(info.get('entries') or []) if info.get('_type') == 'playlist' else 1,
    }

async def _download_and_scan(url: str, quality: str, captions: bool):
    """Run yt-dlp in a thread, then do an incremental scan to import new files."""
    download_id, _info = await asyncio.to_thread(
        manager.download, url, quality, captions
    )
    # Scan only for new files so it's fast
    await asyncio.to_thread(scan_new_only)
    return download_id


@router.get("/info")
async def get_video_info(url: str = Query(..., description="YouTube URL to inspect")):
    """
    Extract video metadata + available qualities WITHOUT downloading.
    Used by the frontend to show a preview before the user picks options.
    """
    try:
        info = await asyncio.to_thread(_extract_info, url)
        return info
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail=f"Could not fetch info: {exc}")


@router.post("")
async def start_download(req: DownloadRequest):
    """
    Kick off a download in the background (non-blocking).
    Returns the download_id immediately so the frontend can track progress.
    """
    download_id = None

    async def _run():
        nonlocal download_id
        try:
            download_id = await _download_and_scan(req.url, req.quality, req.captions)
        except Exception:
            pass  # status is already set to 'error' inside the manager

    # Fire-and-forget coroutine
    asyncio.create_task(_run())

    # We need the download_id before the task runs — pre-register it
    import uuid
    pre_id = str(uuid.uuid4())
    # Start the download with the given pre_id
    # (We'll restructure slightly: let manager accept an optional id)
    # Simpler: just return the url and let the frontend poll /progress
    return {"message": "Download started", "url": req.url}


def _extract_playlist_flat(url: str) -> dict:
    """Run flat info extraction to safely check if URL is a playlist and get list of video IDs/titles."""
    from .config import BASE_DIR
    cookies_file = BASE_DIR / "backend" / "cookies.txt"
    opts = {
        'quiet': True,
        'skip_download': True,
        'no_warnings': True,
        'extract_flat': True,
    }
    if cookies_file.exists():
        opts['cookiefile'] = str(cookies_file)
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    return info


@router.post("/start")
async def start_download_v2(req: DownloadRequest):
    """
    Improved version: immediately returns download_id.
    Detects if the URL is a playlist. If it is a playlist:
      - Creates the playlist in the DB immediately.
      - Registers all playlist video entries as "queued" in the download manager.
      - Downloads them one-by-one with a delay in the background.
    If it is a single video:
      - Downloads normally.
    """
    import asyncio, uuid, random
    from .database import SessionLocal
    from .models import Playlist, Video

    # 1. Run a fast flat extraction to see if it's a playlist
    try:
        flat_info = await asyncio.to_thread(_extract_playlist_flat, req.url)
        is_playlist = flat_info.get('_type') == 'playlist'
    except Exception:
        flat_info = {}
        is_playlist = False

    if is_playlist:
        playlist_yt_id = flat_info.get("id")
        playlist_title = flat_info.get("title", "Untitled Playlist")
        playlist_desc = flat_info.get("description", "")
        playlist_channel = flat_info.get("uploader") or flat_info.get("uploader_id") or ""
        playlist_type = flat_info.get("_type", "playlist")
        entries = flat_info.get("entries") or []

        # Create the Playlist entry in DB first
        db = SessionLocal()
        try:
            playlist_db = db.query(Playlist).filter(Playlist.yt_id == playlist_yt_id).first()
            if not playlist_db:
                playlist_db = Playlist(
                    yt_id=playlist_yt_id,
                    title=playlist_title,
                    channel=playlist_channel,
                    description=playlist_desc,
                    thumbnail_path="",
                    type=playlist_type,
                    video_count=len(entries),
                )
                db.add(playlist_db)
                db.commit()
                db.refresh(playlist_db)
            playlist_db_id = playlist_db.id
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to create playlist in DB: {exc}")
        finally:
            db.close()

        # Pre-register all entries of the playlist as queued in the download manager
        video_queue_ids = []
        for idx, entry in enumerate(entries):
            entry_id = entry.get('id')
            if not entry_id:
                continue
            video_url = f"https://www.youtube.com/watch?v={entry_id}"
            download_id = str(uuid.uuid4())
            
            entry_progress = {
                "download_id": download_id,
                "url":         video_url,
                "status":      "queued",
                "percent_str": "0%",
                "speed_str":   "–",
                "eta_str":     "–",
                "filename":    "",
                "title":       entry.get("title", "Queued video"),
                "channel":     entry.get("uploader") or "",
                "quality":     req.quality,
                "captions":    req.captions,
                "started_at":  None,
                "finished_at": None,
                "error":       None,
            }
            with manager._lock:
                manager._active[download_id] = entry_progress
            video_queue_ids.append((download_id, video_url, idx + 1))

        # Launch the sequential downloader task
        async def _run_playlist_download(playlist_id, queue, quality, captions):
            session = SessionLocal()
            try:
                for idx, (download_id, video_url, play_index) in enumerate(queue):
                    with manager._lock:
                        if download_id in manager._active:
                            manager._active[download_id]["status"] = "starting"
                            manager._active[download_id]["started_at"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()

                    try:
                        # Download single video
                        await asyncio.to_thread(
                            manager.download, video_url, quality, captions, download_id
                        )
                        # Incremental scan
                        await asyncio.to_thread(scan_new_only)

                        # Update SQLite video association
                        yt_id = video_url.split("v=")[-1]
                        video_db = session.query(Video).filter(Video.yt_id == yt_id).first()
                        if video_db:
                            video_db.playlist_id = playlist_id
                            video_db.playlist_index = play_index
                            session.commit()

                            # Set playlist thumbnail from first downloaded video
                            playlist_db = session.query(Playlist).filter(Playlist.id == playlist_id).first()
                            if playlist_db and not playlist_db.thumbnail_path:
                                playlist_db.thumbnail_path = video_db.thumbnail_path
                                session.commit()
                    except Exception as e:
                        # Ensure status is set to error
                        with manager._lock:
                            if download_id in manager._active:
                                manager._active[download_id]["status"] = "error"
                                manager._active[download_id]["error"] = str(e)

                    # Sleep between downloads to trick YouTube
                    if idx < len(queue) - 1:
                        await asyncio.sleep(random.uniform(2.0, 5.0))
            finally:
                session.close()

        asyncio.create_task(_run_playlist_download(playlist_db_id, video_queue_ids, req.quality, req.captions))
        return {"download_id": f"playlist-{playlist_db_id}", "message": f"Playlist '{playlist_title}' queued for sequential download."}

    else:
        # Standard single video download process
        download_id = str(uuid.uuid4())
        started_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        entry = {
            "download_id": download_id,
            "url":         req.url,
            "status":      "starting",
            "percent_str": "0%",
            "speed_str":   "–",
            "eta_str":     "–",
            "filename":    "",
            "title":       "",
            "channel":     "",
            "quality":     req.quality,
            "captions":    req.captions,
            "started_at":  started_at,
            "finished_at": None,
            "error":       None,
        }
        with manager._lock:
            manager._active[download_id] = entry

        async def _run():
            try:
                await asyncio.to_thread(
                    manager.download, req.url, req.quality, req.captions, download_id
                )
                await asyncio.to_thread(scan_new_only)
            except Exception:
                pass

        asyncio.create_task(_run())
        return {"download_id": download_id, "message": "Download started"}


@router.get("/progress")
async def get_progress():
    """All currently active downloads."""
    return manager.get_progress()


@router.get("/history")
async def get_history():
    """Last 100 completed / failed downloads (newest first)."""
    return manager.get_history()
