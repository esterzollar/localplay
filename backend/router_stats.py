"""
router_stats.py — Library statistics endpoint
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from .database import get_db
from .models import Video

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _video_to_dict(v):
    if not v:
        return None
    return {
        "id": v.id,
        "title": v.title,
        "channel": v.channel,
        "duration": v.duration,
        "file_size": v.file_size,
        "thumbnail_path": v.thumbnail_path,
        "upload_date": v.upload_date,
        "downloaded_at": v.downloaded_at.isoformat() if v.downloaded_at else None,
        "view_count": v.view_count,
    }


@router.get("")
async def get_stats(db: Session = Depends(get_db)):
    videos = db.query(Video).all()

    if not videos:
        return {
            "total_videos": 0,
            "total_duration_seconds": 0,
            "total_size_bytes": 0,
            "videos_this_week": 0,
            "videos_this_month": 0,
            "longest_video": None,
            "shortest_video": None,
            "largest_video": None,
            "smallest_video": None,
            "oldest_video": None,
            "most_viewed": None,
            "recent_downloads": [],
            "by_channel": [],
        }

    now = datetime.utcnow()
    week_ago  = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_duration = sum(v.duration  or 0 for v in videos)
    total_size     = sum(v.file_size or 0 for v in videos)
    this_week      = sum(1 for v in videos if v.downloaded_at and v.downloaded_at >= week_ago)
    this_month     = sum(1 for v in videos if v.downloaded_at and v.downloaded_at >= month_ago)

    with_duration = [v for v in videos if v.duration]
    with_size     = [v for v in videos if v.file_size]
    with_views    = [v for v in videos if v.view_count]
    with_date     = [v for v in videos if v.upload_date]

    longest     = max(with_duration, key=lambda v: v.duration)    if with_duration else None
    shortest    = min(with_duration, key=lambda v: v.duration)    if with_duration else None
    largest     = max(with_size,     key=lambda v: v.file_size)   if with_size     else None
    smallest    = min(with_size,     key=lambda v: v.file_size)   if with_size     else None
    oldest      = min(with_date,     key=lambda v: v.upload_date) if with_date     else None
    most_viewed = max(with_views,    key=lambda v: v.view_count)  if with_views    else None

    recent = sorted(videos, key=lambda v: v.downloaded_at or datetime.min, reverse=True)[:6]

    # Per-channel aggregation
    channel_map: dict = {}
    for v in videos:
        ch = v.channel or "Unknown"
        if ch not in channel_map:
            channel_map[ch] = {"name": ch, "count": 0, "total_duration": 0, "total_size": 0}
        channel_map[ch]["count"]          += 1
        channel_map[ch]["total_duration"] += v.duration  or 0
        channel_map[ch]["total_size"]     += v.file_size or 0

    by_channel = sorted(channel_map.values(), key=lambda x: x["count"], reverse=True)

    return {
        "total_videos":          len(videos),
        "total_duration_seconds": total_duration,
        "total_size_bytes":       total_size,
        "videos_this_week":       this_week,
        "videos_this_month":      this_month,
        "longest_video":          _video_to_dict(longest),
        "shortest_video":         _video_to_dict(shortest),
        "largest_video":          _video_to_dict(largest),
        "smallest_video":         _video_to_dict(smallest),
        "oldest_video":           _video_to_dict(oldest),
        "most_viewed":            _video_to_dict(most_viewed),
        "recent_downloads":       [_video_to_dict(v) for v in recent],
        "by_channel":             by_channel,
    }
