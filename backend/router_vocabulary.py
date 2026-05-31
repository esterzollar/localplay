import re
import urllib.request
import json
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from .database import get_db, SessionLocal
from concurrent.futures import ThreadPoolExecutor
from .models import Video, VocabularyWord, VideoVocabulary, VocabularyBoard
from .schemas import (
    VocabularyWord as VocabularyWordSchema,
    VideoVocabulary as VideoVocabularySchema,
    VocabularyBoard as VocabularyBoardSchema,
    VocabularyBoardCreate,
    VocabularyReviewRequest
)
from .config import MEDIA_DIR

router = APIRouter(prefix="/api/vocabulary", tags=["vocabulary"])
log = logging.getLogger(__name__)

COMMON_WORDS_FILE = Path(__file__).parent / "common_words.json"

# ── Spaced Repetition (SM-2) Math ──────────────────────────────────────────

def calculate_next_review(rating: int, repetitions: int, interval_days: int, ease_factor: float):
    """
    SuperMemo-2 Algorithm
    """
    if rating >= 3:
        if repetitions == 0:
            next_interval = 1
        elif repetitions == 1:
            next_interval = 6
        else:
            next_interval = max(1, int(round(interval_days * ease_factor)))
        new_repetitions = repetitions + 1
    else:
        new_repetitions = 0
        next_interval = 1

    # Adjust E-factor
    q = max(0, min(5, rating))
    new_ease_factor = ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    new_ease_factor = max(1.3, round(new_ease_factor, 2))

    return {
        "repetitions": new_repetitions,
        "interval_days": next_interval,
        "ease_factor": new_ease_factor,
        "next_review_at": datetime.now(timezone.utc) + timedelta(days=next_interval)
    }

# ── Subtitle Parser ────────────────────────────────────────────────────────

def get_subtitle_path(video_file_path: Path) -> Optional[Path]:
    """Finds associated .vtt or .srt subtitle file next to the video."""
    base = video_file_path.with_suffix("")
    for ext in [".en.vtt", ".vtt", ".en.srt", ".srt"]:
        sub_file = base.with_name(base.name + ext)
        if sub_file.exists():
            return sub_file
    return None

def parse_subtitles(sub_path: Path) -> List[tuple]:
    """Parses subtitle cues into a list of (start_sec, text) tuples."""
    cues = []
    if not sub_path.exists():
        return cues
    try:
        with open(sub_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception as e:
        log.error("Failed to read subtitle file %s: %s", sub_path, e)
        return cues

    timestamp_re = re.compile(r"(\d{2}):(\d{2}):(\d{2})[.,](\d{3})")
    current_time = 0
    current_text = []

    for line in lines:
        line_str = line.strip()
        if "-->" in line_str:
            # New block started
            if current_text:
                clean_line = re.sub(r"<[^>]+>", "", " ".join(current_text))
                cues.append((current_time, clean_line.strip()))
                current_text = []
            match = timestamp_re.match(line_str)
            if match:
                h, m, s, ms = map(int, match.groups())
                current_time = h * 3600 + m * 60 + s
        elif line_str and not line_str.isdigit() and line_str != "WEBVTT":
            current_text.append(line_str)

    if current_text:
        clean_line = re.sub(r"<[^>]+>", "", " ".join(current_text))
        cues.append((current_time, clean_line.strip()))

    return cues

# ── Common Words Corpus & Dictionary API ───────────────────────────────────

def load_common_words() -> set:
    """Loads common English words from local cache or downloads them."""
    if COMMON_WORDS_FILE.exists():
        try:
            with open(COMMON_WORDS_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            pass

    # Fallback to download Google 5000 common English words
    url = "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-usa-no-swears-medium.txt"
    try:
        log.info("Downloading common words list from GitHub...")
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            words = response.read().decode('utf-8').splitlines()
            words_set = [w.strip().lower() for w in words if len(w.strip()) >= 3]
            with open(COMMON_WORDS_FILE, "w", encoding="utf-8") as f:
                json.dump(words_set, f)
            return set(words_set)
    except Exception as e:
        log.warning("Could not download common words list (%s). Using fallback list.", e)
        # Offline fallback core stopwords/words
        return {
            "the", "and", "you", "that", "was", "for", "are", "with", "his", "they", "one", "have", "this",
            "from", "had", "not", "but", "what", "some", "were", "there", "out", "other", "were", "your",
            "when", "your", "said", "there", "each", "many", "how", "their", "will", "them", "then", "these",
            "some", "would", "like", "into", "time", "has", "look", "more", "write", "go", "see", "number",
            "way", "could", "people", "my", "than", "first", "water", "been", "call", "who", "oil", "its",
            "now", "find", "long", "down", "day", "did", "get", "come", "made", "may", "part", "about",
            "here", "over", "such", "than", "only", "well", "our", "your", "very", "most", "know", "then"
        }

def fetch_definition(word: str) -> dict:
    """Scrapes pronunciation & definitions from Free Dictionary API."""
    url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data and isinstance(data, list):
                entry = data[0]
                phonetic = entry.get("phonetic") or ""
                definition = "No definition found."
                example = ""
                meanings = entry.get("meanings", [])
                if meanings:
                    first_meaning = meanings[0]
                    definitions = first_meaning.get("definitions", [])
                    if definitions:
                        definition = definitions[0].get("definition", "No definition found.")
                        example = definitions[0].get("example", "")
                return {
                    "word": word,
                    "definition": definition,
                    "phonetic": phonetic,
                    "example_sentence": example
                }
    except Exception as e:
        log.warning("Failed to fetch definition for %s: %s", word, e)
        return {
            "word": word,
            "definition": f"Definition not available for '{word}'.",
            "phonetic": "",
            "example_sentence": ""
        }
def update_vocabulary_definitions_task(words: List[str]):
    """Fetches dictionary definitions for newly encountered words in the background to avoid blocking the main server thread."""
    if not words:
        return
    log.info("Starting background definitions fetch for %d words: %s", len(words), words)
    
    # Scrape definitions from the API concurrently
    results = []
    def do_fetch(w):
        try:
            return fetch_definition(w)
        except Exception as e:
            log.warning("Failed to fetch definition for %s: %s", w, e)
            return {
                "word": w,
                "definition": f"Definition not available for '{w}'.",
                "phonetic": "",
                "example_sentence": ""
            }

    with ThreadPoolExecutor(max_workers=min(len(words), 5)) as executor:
        results = list(executor.map(do_fetch, words))

    # Save all fetched definitions to the database in a single transaction
    db = SessionLocal()
    try:
        for res in results:
            word_db = db.query(VocabularyWord).filter(VocabularyWord.word == res["word"]).first()
            if word_db:
                word_db.definition = res["definition"]
                if res.get("phonetic"):
                    word_db.phonetic = res["phonetic"]
                if res.get("example_sentence"):
                    word_db.example_sentence = res["example_sentence"]
        db.commit()
        log.info("Background vocabulary definition updates completed successfully.")
    except Exception as e:
        log.error("Failed to save background vocabulary updates: %s", e)
        db.rollback()
    finally:
        db.close()


@router.get("/video/{video_id}")
def get_video_glossary(video_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Parses subtitle track of a video, identifies rare words, and triggers background fetches for definitions."""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if not video.file_path:
        return []

    video_full_path = MEDIA_DIR / video.file_path
    sub_path = get_subtitle_path(video_full_path)
    if not sub_path:
        return []

    cues = parse_subtitles(sub_path)
    common_words = load_common_words()

    # Find candidate terms
    candidates = []
    seen_words = set()
    for timestamp, text in cues:
        # Match alphabetic tokens 3-15 chars long
        words = re.findall(r"\b[a-zA-Z]{3,15}\b", text)
        for w in words:
            w_lower = w.lower()
            # Ignore common terms
            if w_lower in common_words or len(w_lower) < 4:
                continue
            # Ignore capitalized words in middle of speech cues (proper nouns/names)
            if w[0].isupper() and w_lower in text:
                continue
            if w_lower in seen_words:
                continue

            seen_words.add(w_lower)
            candidates.append((timestamp, w_lower, text))

    # 1. Identify words not in database and prepare placeholders immediately.
    # We do this in a single transaction on the main thread to assign them IDs,
    # avoiding SQLite write-lock contention later and enabling immediate bookmarking.
    missing_words = []
    for timestamp, word_str, context in candidates:
        word_db = db.query(VocabularyWord).filter(VocabularyWord.word == word_str).first()
        if not word_db and word_str not in missing_words:
            missing_words.append(word_str)

    if missing_words:
        try:
            for w_str in missing_words:
                # Double-check to avoid parallel request race conditions
                exists = db.query(VocabularyWord).filter(VocabularyWord.word == w_str).first()
                if not exists:
                    placeholder_word = VocabularyWord(
                        word=w_str,
                        definition="Loading definition...",
                        phonetic="",
                        example_sentence=""
                    )
                    db.add(placeholder_word)
            db.commit()
            # 2. Trigger asynchronous definition fetching task
            background_tasks.add_task(update_vocabulary_definitions_task, missing_words)
        except Exception as e:
            log.error("Failed to create vocabulary placeholders: %s", e)
            db.rollback()

    # 3. Build and return results (which now reference valid word database records)
    results = []
    for timestamp, word_str, context in candidates:
        word_db = db.query(VocabularyWord).filter(VocabularyWord.word == word_str).first()
        if not word_db:
            # Fallback if DB insert somehow failed
            word_id = 0
            definition = f"Definition not available for '{word_str}'."
            phonetic = ""
            example_sentence = ""
        else:
            word_id = word_db.id
            definition = word_db.definition
            phonetic = word_db.phonetic
            example_sentence = word_db.example_sentence

        board_item = db.query(VocabularyBoard).filter(
            VocabularyBoard.word_id == word_id,
            VocabularyBoard.video_id == video_id
        ).first() if word_id else None

        results.append({
            "word_id": word_id,
            "word": word_str,
            "definition": definition,
            "phonetic": phonetic,
            "example_sentence": example_sentence,
            "timestamp": timestamp,
            "context_sentence": context,
            "is_bookmarked": board_item is not None,
            "board_id": board_item.id if board_item else None
        })

    return results

@router.post("/board", response_model=VocabularyBoardSchema)
async def bookmark_word(req: VocabularyBoardCreate, db: Session = Depends(get_db)):
    """Saves a vocabulary word to the Spaced Repetition Study Board."""
    existing = db.query(VocabularyBoard).filter(
        VocabularyBoard.word_id == req.word_id,
        VocabularyBoard.video_id == req.video_id
    ).first()
    if existing:
        return existing

    item = VocabularyBoard(
        word_id=req.word_id,
        video_id=req.video_id,
        timestamp=req.timestamp,
        status="learning",
        ease_factor=2.5,
        interval_days=1,
        repetitions=0,
        next_review_at=datetime.now(timezone.utc)
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.get("/board/queue", response_model=List[VocabularyBoardSchema])
async def get_review_queue(db: Session = Depends(get_db)):
    """Returns the list of vocabulary cards due for review today."""
    now = datetime.now(timezone.utc)
    return db.query(VocabularyBoard).filter(
        VocabularyBoard.next_review_at <= now
    ).order_by(VocabularyBoard.ease_factor.asc()).all()

@router.get("/board/all", response_model=List[VocabularyBoardSchema])
async def get_all_board_cards(db: Session = Depends(get_db)):
    """Returns all vocabulary cards on the study board."""
    return db.query(VocabularyBoard).order_by(VocabularyBoard.created_at.desc()).all()


@router.post("/board/review/{board_id}", response_model=VocabularyBoardSchema)
async def review_card(board_id: int, req: VocabularyReviewRequest, db: Session = Depends(get_db)):
    """Grades a study review and recalculates next active recall interval."""
    item = db.query(VocabularyBoard).filter(VocabularyBoard.id == board_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Card not found")

    metrics = calculate_next_review(
        rating=req.rating,
        repetitions=item.repetitions,
        interval_days=item.interval_days,
        ease_factor=item.ease_factor
    )

    item.repetitions = metrics["repetitions"]
    item.interval_days = metrics["interval_days"]
    item.ease_factor = metrics["ease_factor"]
    item.next_review_at = metrics["next_review_at"]
    if req.rating >= 4 and item.repetitions >= 4:
        item.status = "mastered"
    else:
        item.status = "learning"

    db.commit()
    db.refresh(item)
    return item

@router.delete("/board/{board_id}", status_code=204)
async def delete_board_card(board_id: int, db: Session = Depends(get_db)):
    """Deletes a vocabulary card from the study board."""
    item = db.query(VocabularyBoard).filter(VocabularyBoard.id == board_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(item)
    db.commit()
