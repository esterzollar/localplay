"""
router_playlists.py — playlist endpoints including local playlist creation/management.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List

from .database import get_db
from .models import Playlist, Video
from .schemas import Playlist as PlaylistSchema, PlaylistCreate, PlaylistVideoAdd, PlaylistUpdate

router = APIRouter(prefix="/api/playlists", tags=["playlists"])


@router.get("", response_model=List[PlaylistSchema])
async def list_playlists(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Playlist).order_by(desc(Playlist.downloaded_at)).offset(skip).limit(limit).all()


@router.get("/{playlist_id}", response_model=PlaylistSchema)
async def get_playlist(playlist_id: int, db: Session = Depends(get_db)):
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return pl


# ── Local playlist CRUD ────────────────────────────────────────────────────

@router.post("", response_model=PlaylistSchema, status_code=201)
async def create_playlist(body: PlaylistCreate, db: Session = Depends(get_db)):
    """Create a new local (non-YouTube) playlist."""
    pl = Playlist(
        yt_id=f"local-{uuid.uuid4().hex[:12]}",
        title=body.title,
        type="local",
        video_count=0,
        downloaded_at=datetime.now(timezone.utc),
    )
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return pl


@router.put("/{playlist_id}", response_model=PlaylistSchema)
async def rename_playlist(playlist_id: int, body: PlaylistUpdate, db: Session = Depends(get_db)):
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    pl.title = body.title
    db.commit()
    db.refresh(pl)
    return pl


@router.delete("/{playlist_id}", status_code=204)
async def delete_playlist(playlist_id: int, db: Session = Depends(get_db)):
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    # Detach videos (don't delete them, just remove the link)
    for v in pl.videos:
        v.playlist_id = None
        v.playlist_index = None
    db.delete(pl)
    db.commit()


@router.post("/{playlist_id}/videos", response_model=PlaylistSchema, status_code=201)
async def add_video_to_playlist(
    playlist_id: int, body: PlaylistVideoAdd, db: Session = Depends(get_db)
):
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    video = db.query(Video).filter(Video.id == body.video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video.playlist_id == playlist_id:
        # Already in this playlist
        return pl
    max_index = max((v.playlist_index or 0 for v in pl.videos), default=0)
    video.playlist_id    = playlist_id
    video.playlist_index = max_index + 1
    pl.video_count = len(pl.videos) + 1
    db.commit()
    db.refresh(pl)
    return pl


@router.delete("/{playlist_id}/videos/{video_id}", response_model=PlaylistSchema)
async def remove_video_from_playlist(
    playlist_id: int, video_id: int, db: Session = Depends(get_db)
):
    pl = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    video = db.query(Video).filter(Video.id == video_id, Video.playlist_id == playlist_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not in this playlist")
    video.playlist_id    = None
    video.playlist_index = None
    pl.video_count = max(0, (pl.video_count or 1) - 1)
    db.commit()
    db.refresh(pl)
    return pl
