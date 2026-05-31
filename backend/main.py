import logging
import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from .config import MEDIA_DIR
from .media_scanner import scan_media, scan_single_json
from . import router_download, router_videos, router_playlists, router_search, router_stream, router_stats, router_tags, router_settings, router_notes, router_vocabulary, router_algorithms



log = logging.getLogger(__name__)

# ── File watcher (watchdog) ────────────────────────────────────────────────

def _start_file_watcher():
    """Watch MEDIA_DIR for new .info.json files and auto-import them."""
    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler, FileCreatedEvent

        class InfoJsonHandler(FileSystemEventHandler):
            def on_created(self, event):
                if isinstance(event, FileCreatedEvent) and event.src_path.endswith(".info.json"):
                    from pathlib import Path
                    log.info("File watcher: detected new file %s", event.src_path)
                    scan_single_json(Path(event.src_path))

        observer = Observer()
        observer.schedule(InfoJsonHandler(), str(MEDIA_DIR), recursive=True)
        observer.daemon = True
        observer.start()
        log.info("File watcher started on %s", MEDIA_DIR)
        return observer
    except ImportError:
        log.warning("watchdog not installed — auto-scan disabled. Run: pip install watchdog")
        return None
    except Exception as e:
        log.error("File watcher failed to start: %s", e)
        return None


def patch_database_schema():
    import sqlite3
    from .config import DB_PATH
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(videos)")
        columns = [row[1] for row in cursor.fetchall()]
        if "lci_score" not in columns:
            log.info("Patching database: adding lci_score column to videos table")
            cursor.execute("ALTER TABLE videos ADD COLUMN lci_score FLOAT")
        if "lci_segment_weights" not in columns:
            log.info("Patching database: adding lci_segment_weights column to videos table")
            cursor.execute("ALTER TABLE videos ADD COLUMN lci_segment_weights TEXT")
        conn.commit()
        conn.close()
    except Exception as e:
        log.error("Failed to patch database schema: %s", e)


# ── Lifespan ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Patch database schema for new columns if they do not exist
    patch_database_schema()

    # Ensure database tables are created
    from .database import engine
    from .models import Base
    Base.metadata.create_all(bind=engine)

    # Full scan on startup to catch anything downloaded while server was off
    scan_media()
    # Start watching for new files in background thread
    _start_file_watcher()
    yield


# ── App ────────────────────────────────────────────────────────────────────

app = FastAPI(title="LocalPlay", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")

app.include_router(router_download.router)
app.include_router(router_videos.router)
app.include_router(router_playlists.router)
app.include_router(router_search.router)
app.include_router(router_stream.router)
app.include_router(router_stats.router)
app.include_router(router_tags.router)
app.include_router(router_settings.router)
app.include_router(router_notes.router)
app.include_router(router_vocabulary.router)
app.include_router(router_algorithms.router)

