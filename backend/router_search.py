from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from .database import get_db
from .models import Video
from .schemas import Video as VideoSchema
from sqlalchemy import or_
import json

router = APIRouter(prefix="/api/search", tags=["search"])

def levenshtein_distance(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
        
    return previous_row[-1]

def calculate_relevance_score(query_tokens: List[str], video: Video) -> float:
    score = 0.0
    
    title_raw = (video.title or "").lower()
    channel_raw = (video.channel or "").lower()
    desc_raw = (video.description or "").lower()
    
    title_tokens = [t for t in title_raw.split() if t]
    channel_tokens = [t for t in channel_raw.split() if t]
    desc_tokens = [t for t in desc_raw.split() if t]
    
    tag_tokens = []
    if video.tags:
        try:
            parsed = json.loads(video.tags)
            if isinstance(parsed, list):
                tag_tokens = [str(tag).lower() for tag in parsed]
            else:
                tag_tokens = [t for t in str(video.tags).lower().split() if t]
        except Exception:
            tag_tokens = [t for t in str(video.tags).lower().split() if t]
            
    full_query = " ".join(query_tokens)
    
    # Significant boost for full exact substring matches in title/channel
    if full_query in title_raw:
        score += 30.0
    elif any(token in title_raw for token in query_tokens):
        score += 5.0
        
    if full_query in channel_raw:
        score += 15.0
        
    for q_tok in query_tokens:
        # 1. Exact token match
        if q_tok in title_tokens:
            score += 15.0
        elif q_tok in channel_tokens:
            score += 8.0
        elif q_tok in tag_tokens:
            score += 8.0
        elif q_tok in desc_tokens:
            score += 3.0
            
        # 2. Prefix/Partial match (starts/ends with)
        else:
            matched_partial = False
            for t_tok in title_tokens:
                if t_tok.startswith(q_tok) or q_tok.startswith(t_tok):
                    score += 6.0
                    matched_partial = True
                    break
            if not matched_partial:
                for c_tok in channel_tokens:
                    if c_tok.startswith(q_tok) or q_tok.startswith(c_tok):
                        score += 4.0
                        matched_partial = True
                        break
            if not matched_partial:
                for tg_tok in tag_tokens:
                    if tg_tok.startswith(q_tok) or q_tok.startswith(tg_tok):
                        score += 4.0
                        matched_partial = True
                        break
            if not matched_partial:
                for d_tok in desc_tokens:
                    if d_tok.startswith(q_tok) or q_tok.startswith(d_tok):
                        score += 1.5
                        break
            
            # 3. Fuzzy Levenshtein match (typo tolerance)
            if not matched_partial:
                best_fuzzy_score = 0.0
                q_len = len(q_tok)
                for candidate_list, weight in [(title_tokens, 5.0), (channel_tokens, 3.0), (tag_tokens, 3.0), (desc_tokens, 1.0)]:
                    for c_tok in candidate_list:
                        c_len = len(c_tok)
                        if abs(q_len - c_len) <= 2:
                            dist = levenshtein_distance(q_tok, c_tok)
                            if dist == 1:
                                best_fuzzy_score = max(best_fuzzy_score, weight)
                            elif dist == 2 and q_len >= 5 and c_len >= 5:
                                best_fuzzy_score = max(best_fuzzy_score, weight * 0.5)
                score += best_fuzzy_score
                
    return score

@router.get("", response_model=List[VideoSchema])
async def search_videos(q: str, limit: int = 20, db: Session = Depends(get_db)):
    if not q or not q.strip():
        return []
        
    query_tokens = [t.lower() for t in q.strip().split() if t]
    if not query_tokens:
        return []
        
    videos = db.query(Video).filter(
        or_(
            Video.height == None,
            Video.width == None,
            Video.height <= Video.width
        )
    ).all()
    
    scored_videos = []
    for video in videos:
        score = calculate_relevance_score(query_tokens, video)
        if score > 0:
            scored_videos.append((score, video))
            
    scored_videos.sort(key=lambda x: x[0], reverse=True)
    
    return [video for score, video in scored_videos[:limit]]
