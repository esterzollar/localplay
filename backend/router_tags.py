"""
router_tags.py — Auto-tags from yt-dlp metadata
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import json
from .database import get_db
from .models import Video

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("")
async def get_all_tags(db: Session = Depends(get_db)):
    """
    Parse tags + categories from every video's stored JSON and return
    unique tags sorted by frequency (most common first, top 60).
    """
    rows = db.query(Video.tags, Video.categories).all()
    tag_counts: dict[str, int] = {}

    for tags_str, cats_str in rows:
        for field in (tags_str, cats_str):
            if not field:
                continue
            try:
                items = json.loads(field)
                for item in (items or []):
                    if item and isinstance(item, str):
                        tag = item.strip()
                        if tag and len(tag) > 1 and len(tag) < 60:
                            tag_counts[tag] = tag_counts.get(tag, 0) + 1
            except Exception:
                pass

    sorted_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:60]
    return [{"tag": t, "count": c} for t, c in sorted_tags]


@router.get("/video/{video_id}")
async def get_video_tags(video_id: int, db: Session = Depends(get_db)):
    """Return tags and categories for a specific video."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        return {"tags": [], "categories": []}

    tags, cats = [], []
    try:
        tags = json.loads(video.tags or "[]") or []
    except Exception:
        pass
    try:
        cats = json.loads(video.categories or "[]") or []
    except Exception:
        pass

    return {"tags": tags[:10], "categories": cats[:5]}
