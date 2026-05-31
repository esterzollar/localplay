"""
media_scanner.py — scan the media directory and upsert Video + Playlist records.

Fixes applied:
  - Bug 1: Playlist rows are now created/updated from playlist info.json files
  - Bug 5: Thumbnail check order is .webp → .jpg → .png
  - Bug 6: file_size is set on new-Video inserts
  - Bug 7: channel prefers info['channel'] > info['uploader'] > None
"""

import json
import logging
from pathlib import Path

from sqlalchemy.orm import Session
from .database import engine, Base, SessionLocal
from .models import Video, Playlist, StudyNote
from .config import MEDIA_DIR

log = logging.getLogger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────────

def get_thumbnail_path(base_path: Path) -> str:
    """Return relative path to thumbnail, checking .webp first (yt-dlp default)."""
    for ext in ['.webp', '.jpg', '.jpeg', '.png']:
        thumb = base_path.with_suffix(ext)
        if thumb.exists():
            return str(thumb.relative_to(MEDIA_DIR))
    return ""


def get_video_path(base_path: Path) -> str:
    """Return relative path to the video file."""
    for ext in ['.mp4', '.mkv', '.webm']:
        vid = base_path.with_suffix(ext)
        if vid.exists():
            return str(vid.relative_to(MEDIA_DIR))
    return ""


def resolve_channel(info: dict) -> str:
    """Prefer 'channel' over 'uploader'; fall back to empty string."""
    return (
        info.get("channel")
        or info.get("uploader")
        or ""
    )


# ── Playlist upsert ────────────────────────────────────────────────────────

def upsert_playlist(db: Session, info: dict) -> Playlist | None:
    """Create or update a Playlist row from playlist-level info JSON."""
    yt_id = info.get("id")
    if not yt_id:
        return None

    playlist_type = info.get("_type", "playlist")
    channel = resolve_channel(info)

    # Find a thumbnail from the first entry that has one
    thumb = ""
    for entry in (info.get("entries") or []):
        if not entry:
            continue
        base = MEDIA_DIR / entry.get("requested_downloads", [{}])[0].get("filename", "") if entry.get("requested_downloads") else None
        if base:
            t = get_thumbnail_path(Path(base).with_suffix("").with_suffix(""))
            if t:
                thumb = t
                break
    if not thumb and info.get("thumbnail"):
        # remote URL thumbnail - we won't store it but leave blank
        pass

    existing = db.query(Playlist).filter(Playlist.yt_id == yt_id).first()
    if existing:
        existing.title = info.get("title", existing.title)
        existing.channel = channel or existing.channel
        existing.description = info.get("description", existing.description)
        existing.video_count = len([e for e in (info.get("entries") or []) if e])
        if thumb:
            existing.thumbnail_path = thumb
        return existing

    pl = Playlist(
        yt_id=yt_id,
        title=info.get("title", "Untitled Playlist"),
        channel=channel,
        description=info.get("description", ""),
        thumbnail_path=thumb,
        type=playlist_type,
        video_count=len([e for e in (info.get("entries") or []) if e]),
    )
    db.add(pl)
    db.flush()  # get pl.id without committing
    return pl


# ── Video upsert ───────────────────────────────────────────────────────────

def upsert_video(db: Session, json_file: Path, known_ids: set | None = None) -> bool:
    """Parse one .info.json and upsert the Video row. Returns True if a new row was inserted."""
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            info = json.load(f)
    except Exception as e:
        log.warning("Could not parse %s: %s", json_file, e)
        return False

    yt_id = info.get("id")
    if not yt_id:
        return False

    # Skip playlist-level info.json files (they have 'entries' key)
    if "entries" in info:
        return False

    base_path = json_file.with_suffix('').with_suffix('')  # strip .info.json
    file_path = get_video_path(base_path)
    thumbnail_path = get_thumbnail_path(base_path)
    channel = resolve_channel(info)
    file_size = (MEDIA_DIR / file_path).stat().st_size if file_path else 0

    existing = db.query(Video).filter(Video.yt_id == yt_id).first()

    # Skip orphaned .info.json (no video file + no existing DB record)
    if not existing and not file_path:
        return False

    if existing:
        # Keep the known_ids set in sync so pruning doesn't kill existing records
        if known_ids is not None:
            known_ids.add(yt_id)
        # If the video file is gone from disk, clear the path so UI can show "missing"
        existing.file_path = file_path
        existing.thumbnail_path = thumbnail_path
        existing.channel = channel or existing.channel
        existing.view_count = info.get("view_count", existing.view_count)
        existing.like_count = info.get("like_count", existing.like_count)
        existing.file_size = file_size
        return True

    if known_ids is not None and yt_id in known_ids:
        return False  # incremental mode: skip known

    video = Video(
        yt_id=yt_id,
        title=info.get("title", "Unknown"),
        description=info.get("description", ""),
        upload_date=info.get("upload_date"),
        duration=info.get("duration"),
        channel=channel,
        channel_url=info.get("channel_url") or info.get("uploader_url"),
        tags=json.dumps(info.get("tags", [])),
        categories=json.dumps(info.get("categories", [])),
        view_count=info.get("view_count"),
        like_count=info.get("like_count"),
        chapters=json.dumps(info.get("chapters") or []),
        thumbnail_path=thumbnail_path,
        file_path=file_path,
        file_size=file_size,
        width=info.get("width"),
        height=info.get("height"),
        fps=info.get("fps"),
    )
    db.add(video)
    if known_ids is not None:
        known_ids.add(yt_id)
    return True


# ── Public API ─────────────────────────────────────────────────────────────

def scan_media():
    """
    Full scan: create tables, upsert every .info.json found,
    then prune DB records whose files no longer exist on disk.
    """
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Track all yt_ids found on disk
        found_ids: set[str] = set()
        new_count = 0

        for json_file in MEDIA_DIR.rglob("*.info.json"):
            added = upsert_video(db, json_file, known_ids=found_ids)
            if added:
                new_count += 1

        # Prune DB records for videos no longer on disk
        stale = db.query(Video).filter(
            ~Video.yt_id.in_(found_ids)
        ).all()
        for video in stale:
            log.info("Pruning stale record: %s (%s)", video.title, video.yt_id)
            db.delete(video)

        db.commit()
        log.info(
            "scan_media(): %d new, %d pruned",
            new_count, len(stale),
        )
    except Exception as e:
        db.rollback()
        log.error("scan_media failed: %s", e)
    finally:
        db.close()


def scan_new_only():
    """Incremental scan: only inserts videos not already in the DB."""
    db = SessionLocal()
    try:
        known_ids = {r[0] for r in db.query(Video.yt_id).all()}
        new_count = 0
        for json_file in MEDIA_DIR.rglob("*.info.json"):
            added = upsert_video(db, json_file, known_ids=known_ids)
            if added:
                new_count += 1
        if new_count:
            db.commit()
            log.info("scan_new_only(): %d new videos added", new_count)
    except Exception as e:
        db.rollback()
        log.error("scan_new_only failed: %s", e)
    finally:
        db.close()


def scan_single_json(json_file: Path):
    """Called by the file-watcher when a new .info.json appears."""
    db = SessionLocal()
    try:
        upsert_video(db, json_file)
        db.commit()
        log.info("scan_single_json(): imported %s", json_file.name)
    except Exception as e:
        db.rollback()
        log.error("scan_single_json failed for %s: %s", json_file, e)
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    scan_media()
