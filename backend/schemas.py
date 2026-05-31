from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class VideoBase(BaseModel):
    yt_id: str
    title: str
    description: Optional[str] = None
    upload_date: Optional[str] = None
    duration: Optional[int] = None
    channel: Optional[str] = None
    channel_url: Optional[str] = None
    tags: Optional[str] = None
    categories: Optional[str] = None
    view_count: Optional[int] = None
    like_count: Optional[int] = None
    thumbnail_path: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    chapters: Optional[str] = None
    lci_score: Optional[float] = None
    lci_segment_weights: Optional[str] = None

class Video(VideoBase):
    id: int
    downloaded_at: datetime
    playlist_id: Optional[int] = None
    playlist_index: Optional[int] = None

    class Config:
        from_attributes = True



class PlaylistBase(BaseModel):
    yt_id: str
    title: str
    channel: Optional[str] = None
    description: Optional[str] = None
    thumbnail_path: Optional[str] = None
    type: Optional[str] = None
    video_count: Optional[int] = 0

class Playlist(PlaylistBase):
    id: int
    downloaded_at: datetime
    videos: List[Video] = []

    class Config:
        from_attributes = True

# Download
class DownloadRequest(BaseModel):
    url: str
    quality: str = "best"     # best | 1080p | 720p | 480p | 360p
    captions: bool = False     # download English subtitles

# Playlist management (local playlists)
class PlaylistCreate(BaseModel):
    title: str

class PlaylistVideoAdd(BaseModel):
    video_id: int

class PlaylistUpdate(BaseModel):
    title: str

class SettingsUpdate(BaseModel):
    default_quality: str = "best"
    cookie_content: Optional[str] = None


# Study Notes
class StudyNoteBase(BaseModel):
    timestamp: int
    content: str

class StudyNoteCreate(StudyNoteBase):
    pass

class StudyNote(StudyNoteBase):
    id: int
    video_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Video Interactions
class VideoInteractionBase(BaseModel):
    event_type: str
    timestamp: float
    duration: float = 0.0

class VideoInteractionCreate(VideoInteractionBase):
    pass

class VideoInteraction(VideoInteractionBase):
    id: int
    video_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Vocabulary Schemas

class VocabularyWordBase(BaseModel):
    word: str
    definition: str
    phonetic: Optional[str] = None
    example_sentence: Optional[str] = None

class VocabularyWord(VocabularyWordBase):
    id: int

    class Config:
        from_attributes = True

class VideoVocabularyBase(BaseModel):
    video_id: int
    word_id: int
    timestamp: int
    context_sentence: str

class VideoVocabulary(VideoVocabularyBase):
    id: int
    word: VocabularyWord

    class Config:
        from_attributes = True

class VocabularyBoardCreate(BaseModel):
    word_id: int
    video_id: int
    timestamp: int

class VocabularyBoard(BaseModel):
    id: int
    word_id: int
    video_id: int
    timestamp: int
    status: str
    ease_factor: float
    interval_days: int
    repetitions: int
    next_review_at: datetime
    created_at: datetime
    word: VocabularyWord
    video: Video

    class Config:
        from_attributes = True

class VocabularyReviewRequest(BaseModel):
    rating: int # SM-2 score 0-5


