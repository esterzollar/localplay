from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, index=True)
    yt_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    channel = Column(String)
    description = Column(String)
    thumbnail_path = Column(String)
    type = Column(String) # 'playlist' | 'album' | 'channel'
    video_count = Column(Integer, default=0)
    downloaded_at = Column(DateTime, default=datetime.utcnow)

    videos = relationship("Video", back_populates="playlist")


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    yt_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, index=True, nullable=False)
    description = Column(String)
    upload_date = Column(String, index=True)
    duration = Column(Integer)
    channel = Column(String, index=True)
    channel_url = Column(String)
    tags = Column(String) # stored as json string
    categories = Column(String) # stored as json string
    view_count = Column(Integer)
    like_count = Column(Integer)
    comments = Column(String)
    chapters = Column(String)
    thumbnail_path = Column(String)
    file_path = Column(String)
    file_size = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    fps = Column(Float)
    downloaded_at = Column(DateTime, default=datetime.utcnow)
    
    playlist_id = Column(Integer, ForeignKey("playlists.id"), nullable=True)
    playlist_index = Column(Integer, nullable=True)

    playlist = relationship("Playlist", back_populates="videos")
    lci_score = Column(Float, nullable=True)
    lci_segment_weights = Column(String, nullable=True) # JSON string of list of floats



class StudyNote(Base):
    __tablename__ = "study_notes"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)
    timestamp = Column(Integer, nullable=False)  # in seconds
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    video = relationship("Video", backref="notes")


class VocabularyWord(Base):
    __tablename__ = "vocabulary_words"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String, unique=True, index=True, nullable=False)
    definition = Column(String, nullable=False)
    phonetic = Column(String, nullable=True)
    example_sentence = Column(String, nullable=True)


class VideoVocabulary(Base):
    __tablename__ = "video_vocabulary"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)
    word_id = Column(Integer, ForeignKey("vocabulary_words.id"), nullable=False)
    timestamp = Column(Integer, nullable=False)
    context_sentence = Column(String, nullable=False)

    video = relationship("Video", backref="vocabulary")
    word = relationship("VocabularyWord")


class VocabularyBoard(Base):
    __tablename__ = "vocabulary_board"

    id = Column(Integer, primary_key=True, index=True)
    word_id = Column(Integer, ForeignKey("vocabulary_words.id"), nullable=False)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)
    timestamp = Column(Integer, nullable=False)
    status = Column(String, default="learning")
    ease_factor = Column(Float, default=2.5)
    interval_days = Column(Integer, default=1)
    repetitions = Column(Integer, default=0)
    next_review_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    word = relationship("VocabularyWord")
    video = relationship("Video")


class VideoInteraction(Base):
    __tablename__ = "video_interactions"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)
    event_type = Column(String, nullable=False)  # "note_added" | "speed_change" | "seek_backward" | "video_paused"
    timestamp = Column(Float, nullable=False)
    duration = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    video = relationship("Video")



