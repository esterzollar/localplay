import logging
import json
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from .database import get_db, SessionLocal
from .models import Video, VideoInteraction
from .schemas import VideoInteractionCreate, VideoInteraction as VideoInteractionSchema
from .config import MEDIA_DIR

# Ensure algorithm is in import path
import sys
sys.path.append(str(Path(__file__).parent.parent))
from algorithm.algorithm import NeuralLCIEngine, AdaptiveChapteringEngine

router = APIRouter(prefix="/api/videos", tags=["algorithms"])
log = logging.getLogger(__name__)

MODEL_WEIGHTS_FILE = Path(__file__).parent / "lci_model.json"

# Helper to format timestamp
def fmt_timestamp(sec: float) -> str:
    t = int(sec)
    h = t // 3600
    m = (t % 3600) // 60
    s = t % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"

# Background task for chapter detection
def run_auto_chaptering(video_id: int):
    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video or not video.file_path:
            log.warning("Video %s not found or has no file path for auto-chaptering", video_id)
            return

        video_path = MEDIA_DIR / video.file_path
        if not video_path.exists():
            log.warning("Video file not found at %s", video_path)
            return

        log.info("Starting background auto-chaptering for video %d (%s)...", video_id, video.title)
        
        # Instantiate chaptering engine
        engine = AdaptiveChapteringEngine()
        
        # Run detection
        cuts = engine.detect_chapters(str(video_path), use_audio=True)
        
        # Build chapters JSON structures
        chapters_data = []
        # Always insert a starting chapter at 0 if not present
        if not cuts or cuts[0] > 2.0:
            chapters_data.append({
                "start_time": 0.0,
                "title": f"Intro ({fmt_timestamp(0.0)})"
            })
            
        for i, ts in enumerate(cuts):
            chapters_data.append({
                "start_time": float(ts),
                "title": f"Chapter {i+1} ({fmt_timestamp(ts)})"
            })
            
        video.chapters = json.dumps(chapters_data)
        db.commit()
        log.info("Auto-chaptering completed for video %d. Found %d chapters.", video_id, len(chapters_data))
    except Exception as e:
        log.error("Background chaptering failed for video %d: %s", video_id, e)
    finally:
        db.close()


@router.post("/{video_id}/interactions", response_model=dict)
async def record_interaction(video_id: int, req: VideoInteractionCreate, db: Session = Depends(get_db)):
    """Logs a player interaction, recomputes LCI weights, and updates video details."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # 1. Save new interaction
    interaction = VideoInteraction(
        video_id=video_id,
        event_type=req.event_type,
        timestamp=req.timestamp,
        duration=req.duration
    )
    db.add(interaction)
    db.commit()
    db.refresh(interaction)

    # 2. Fetch all interactions for video
    all_interactions = db.query(VideoInteraction).filter(VideoInteraction.video_id == video_id).all()
    interactions_dicts = [
        {"event_type": i.event_type, "timestamp": i.timestamp, "duration": i.duration}
        for i in all_interactions
    ]

    # 3. Instantiate and run LCI Neural Engine
    lci_engine = NeuralLCIEngine()
    if MODEL_WEIGHTS_FILE.exists():
        try:
            lci_engine.net.load(str(MODEL_WEIGHTS_FILE))
        except Exception as e:
            log.warning("Could not load LCI neural model weights: %s", e)

    video_duration = video.duration or int(max((i.timestamp for i in all_interactions), default=120))
    
    weights = lci_engine.compute_segment_weights(interactions_dicts, float(video_duration))
    lci_score = lci_engine.calculate_lci(weights, float(video_duration))

    # 4. Save results to Video model
    video.lci_score = lci_score
    video.lci_segment_weights = json.dumps(weights)
    db.commit()

    return {
        "lci_score": lci_score,
        "lci_segment_weights": weights
    }


@router.post("/{video_id}/feedback", response_model=dict)
async def submit_difficulty_feedback(video_id: int, payload: dict, db: Session = Depends(get_db)):
    """Submit subjective difficulty feedback (rating 0-10) to train the Neural LCI model."""
    rating = payload.get("rating")
    if rating is None or not (0 <= rating <= 10):
        raise HTTPException(status_code=400, detail="Rating must be a number between 0 and 10")

    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Fetch interactions to feed the training step
    all_interactions = db.query(VideoInteraction).filter(VideoInteraction.video_id == video_id).all()
    if not all_interactions:
        raise HTTPException(status_code=400, detail="No interaction logs found for this video. Cannot train model.")

    interactions_dicts = [
        {"event_type": i.event_type, "timestamp": i.timestamp, "duration": i.duration}
        for i in all_interactions
    ]

    # Initialize neural model
    lci_engine = NeuralLCIEngine()
    if MODEL_WEIGHTS_FILE.exists():
        try:
            lci_engine.net.load(str(MODEL_WEIGHTS_FILE))
        except Exception:
            pass

    video_duration = float(video.duration or max((i.timestamp for i in all_interactions), default=120))

    # Run MLP training step
    lci_engine.learn_from_feedback(interactions_dicts, video_duration, float(rating))
    
    # Save trained model weights
    try:
        lci_engine.net.save(str(MODEL_WEIGHTS_FILE))
    except Exception as e:
        log.error("Failed to save LCI neural model weights: %s", e)

    # Re-evaluate LCI segments with updated network
    new_weights = lci_engine.compute_segment_weights(interactions_dicts, video_duration)
    new_lci = lci_engine.calculate_lci(new_weights, video_duration)

    video.lci_score = new_lci
    video.lci_segment_weights = json.dumps(new_weights)
    db.commit()

    return {
        "lci_score": new_lci,
        "lci_segment_weights": new_weights
    }


@router.post("/{video_id}/auto-chapters", status_code=202)
async def trigger_auto_chaptering(video_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Asynchronously starts CV2/FFmpeg scene-cut auto-chaptering for a video."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if not video.file_path:
        raise HTTPException(status_code=400, detail="Video has no local file path associated")

    background_tasks.add_task(run_auto_chaptering, video_id)
    return {"message": "Auto-chaptering started in the background"}
