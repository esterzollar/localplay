import os
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from .database import get_db
from .models import Video
from .config import MEDIA_DIR

router = APIRouter(prefix="/api/stream", tags=["stream"])

def parse_range(range_header: str, file_size: int):
    range_match = range_header.replace("bytes=", "").split("-")
    start = int(range_match[0]) if range_match[0] else 0
    end = int(range_match[1]) if len(range_match) > 1 and range_match[1] else file_size - 1
    return start, end

@router.get("/{video_id}")
async def stream_video(video_id: int, request: Request, range: str = Header(None), db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video or not video.file_path:
        raise HTTPException(status_code=404, detail="Video not found")
        
    file_path = MEDIA_DIR / video.file_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video file missing")

    file_size = file_path.stat().st_size
    
    if range is None:
        return FileResponse(file_path, media_type="video/mp4", headers={"Accept-Ranges": "bytes"})

    start, end = parse_range(range, file_size)
    
    if start >= file_size:
        return StreamingResponse(iter([]), status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

    chunk_size = (end - start) + 1
    
    def iterfile():
        with open(file_path, mode="rb") as file_like:
            file_like.seek(start)
            bytes_left = chunk_size
            while bytes_left > 0:
                chunk = file_like.read(min(bytes_left, 1024 * 1024))
                if not chunk:
                    break
                bytes_left -= len(chunk)
                yield chunk

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Content-Type": "video/mp4",
    }
    
    return StreamingResponse(
        iterfile(),
        status_code=206,
        headers=headers,
    )
