"""
router_notes.py — study notes endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .database import get_db
from .models import StudyNote, Video
from .schemas import StudyNote as StudyNoteSchema, StudyNoteCreate

router = APIRouter(prefix="/api/notes", tags=["notes"])


def update_video_tfidf_tags(video_id: int, db: Session):
    import json
    import sys
    from pathlib import Path
    sys.path.append(str(Path(__file__).parent.parent))
    from algorithm.algorithm import AdaptiveTFIDFAnalyzer

    # 1. Fetch all videos with notes
    videos_with_notes = db.query(Video).join(StudyNote).all()
    if not videos_with_notes:
        return

    # 2. Build corpus documents
    documents = {}
    for v in videos_with_notes:
        notes_text = " ".join(n.content for n in v.notes)
        if notes_text.strip():
            documents[v.id] = notes_text

    # If the video we are editing doesn't have any notes, clear its tags or skip
    if video_id not in documents:
        video = db.query(Video).filter(Video.id == video_id).first()
        if video:
            video.tags = json.dumps([])
            db.commit()
        return

    # 3. Analyze and extract top tags
    analyzer = AdaptiveTFIDFAnalyzer()
    try:
        # Extract top 5 tags in BM25 mode
        tags_scores = analyzer.extract_top_tags(documents, video_id, top_n=5, mode="bm25")
        tag_list = [tag for tag, score in tags_scores]
        
        # Save tags to video
        video = db.query(Video).filter(Video.id == video_id).first()
        if video:
            video.tags = json.dumps(tag_list)
            db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Failed to run TF-IDF tag extraction for video %d: %s", video_id, e)


@router.post("/video/{video_id}", response_model=StudyNoteSchema, status_code=201)
async def create_note(video_id: int, body: StudyNoteCreate, db: Session = Depends(get_db)):
    # Check if video exists
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    note = StudyNote(
        video_id=video_id,
        timestamp=body.timestamp,
        content=body.content
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    # Trigger auto-tagging
    update_video_tfidf_tags(video_id, db)

    return note


@router.get("/video/{video_id}", response_model=List[StudyNoteSchema])
async def get_video_notes(video_id: int, db: Session = Depends(get_db)):
    # Check if video exists
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return db.query(StudyNote).filter(StudyNote.video_id == video_id).order_by(StudyNote.timestamp.asc()).all()


@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(StudyNote).filter(StudyNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    video_id = note.video_id
    db.delete(note)
    db.commit()

    # Trigger auto-tagging
    update_video_tfidf_tags(video_id, db)

