from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from typing import List
from .database import get_db
from .models import Video
from .schemas import Video as VideoSchema

router = APIRouter(prefix="/api/videos", tags=["videos"])

@router.get("", response_model=List[VideoSchema])
async def list_videos(skip: int = 0, limit: int = 20, sort: str = "date", db: Session = Depends(get_db)):
    query = db.query(Video).filter(
        or_(
            Video.height == None,
            Video.width == None,
            Video.height <= Video.width
        )
    )
    if sort == "date":
        query = query.order_by(desc(Video.upload_date))
    elif sort == "views":
        query = query.order_by(desc(Video.view_count))
    else:
        query = query.order_by(desc(Video.downloaded_at))
    return query.offset(skip).limit(limit).all()

@router.get("/latest", response_model=List[VideoSchema])
async def get_latest_videos(limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Video).filter(
        or_(
            Video.height == None,
            Video.width == None,
            Video.height <= Video.width
        )
    ).order_by(desc(Video.downloaded_at)).limit(limit).all()

@router.get("/shorts", response_model=List[VideoSchema])
async def get_shorts_videos(db: Session = Depends(get_db)):
    """Return all vertical videos (where height > width)."""
    return db.query(Video).filter(
        Video.height != None,
        Video.width != None,
        Video.height > Video.width
    ).order_by(desc(Video.downloaded_at)).all()

@router.get("/channels")
async def list_channels(db: Session = Depends(get_db)):
    """Return all unique channels with video count and a representative thumbnail."""
    from sqlalchemy import func
    rows = (
        db.query(
            Video.channel,
            func.count(Video.id).label("video_count"),
            func.max(Video.downloaded_at).label("last_downloaded"),
        )
        .filter(Video.channel != None, Video.channel != "")
        .group_by(Video.channel)
        .order_by(func.count(Video.id).desc())
        .all()
    )
    result = []
    for row in rows:
        sample = (
            db.query(Video)
            .filter(Video.channel == row.channel, Video.thumbnail_path != None)
            .order_by(desc(Video.downloaded_at))
            .first()
        )
        result.append({
            "name": row.channel,
            "video_count": row.video_count,
            "thumbnail_path": sample.thumbnail_path if sample else None,
        })
    return result

@router.get("/channel/{channel_name}", response_model=List[VideoSchema])
async def get_channel_videos(
    channel_name: str,
    q: str = "",
    sort: str = "date",
    db: Session = Depends(get_db),
):
    """All videos for a specific channel, optionally filtered by a search query."""
    query = db.query(Video).filter(
        Video.channel == channel_name,
        or_(
            Video.height == None,
            Video.width == None,
            Video.height <= Video.width
        )
    )
    if q:
        term = f"%{q}%"
        query = query.filter(
            or_(Video.title.ilike(term), Video.description.ilike(term))
        )
    if sort == "views":
        query = query.order_by(desc(Video.view_count))
    elif sort == "oldest":
        query = query.order_by(Video.upload_date)
    else:
        query = query.order_by(desc(Video.upload_date))
    return query.all()

@router.get("/{video_id}", response_model=VideoSchema)
async def get_video(video_id: int, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video

@router.get("/{video_id}/similar", response_model=List[VideoSchema])
async def get_similar_videos(video_id: int, limit: int = 10, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Try fetching from the same channel first
    same_channel = db.query(Video).filter(
        Video.channel == video.channel,
        Video.id != video.id
    ).limit(limit).all()
    
    results = list(same_channel)
    
    # If we need more videos, fill it with latest downloads in the library
    if len(results) < limit:
        needed = limit - len(results)
        exclude_ids = [video.id] + [v.id for v in results]
        
        others = db.query(Video).filter(
            ~Video.id.in_(exclude_ids)
        ).order_by(desc(Video.downloaded_at)).limit(needed).all()
        
        results.extend(others)
        
    return results


@router.delete("/{video_id}", status_code=204)
async def delete_video(video_id: int, delete_files: bool = False, db: Session = Depends(get_db)):
    """
    Remove a video from the library.
    Always deletes the .info.json so the media scanner cannot re-add the video.
    Pass ?delete_files=true to also delete the video + media files from disk,
    and remove the channel folder if it becomes empty.
    """
    from pathlib import Path
    from .config import MEDIA_DIR

    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    folder = None
    if video.file_path:
        base = MEDIA_DIR / Path(video.file_path)
        stem = base.stem
        folder = base.parent

        if delete_files:
            # Delete everything: video, thumbnail, subtitles, info.json, etc.
            for f in folder.glob(f"{stem}*"):
                try:
                    f.unlink()
                except Exception:
                    pass
        else:
            # Always remove the .info.json so the scanner can't resurrect this video
            info_json = folder / f"{stem}.info.json"
            try:
                if info_json.exists():
                    info_json.unlink()
            except Exception:
                pass

    db.delete(video)
    db.commit()

    # Clean up empty channel folder after commit
    if delete_files and folder and folder.exists():
        try:
            remaining = list(folder.iterdir())
            if not remaining:
                folder.rmdir()
        except Exception:
            pass
