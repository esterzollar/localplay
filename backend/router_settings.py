import json
import logging
from pathlib import Path
from fastapi import APIRouter
from .schemas import SettingsUpdate
from .config import BASE_DIR

router = APIRouter(prefix="/api/settings", tags=["settings"])
log = logging.getLogger(__name__)

SETTINGS_FILE = BASE_DIR / "backend" / "settings.json"
COOKIES_FILE = BASE_DIR / "backend" / "cookies.txt"

def load_settings() -> dict:
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log.error("Failed to load settings: %s", e)
    return {"default_quality": "best"}

@router.get("")
async def get_settings():
    settings = load_settings()
    cookie_content = ""
    if COOKIES_FILE.exists():
        try:
            with open(COOKIES_FILE, "r", encoding="utf-8") as f:
                cookie_content = f.read()
        except Exception as e:
            log.error("Failed to read cookies: %s", e)
    
    return {
        "default_quality": settings.get("default_quality", "best"),
        "cookie_content": cookie_content,
        "has_cookies": bool(cookie_content.strip())
    }

@router.post("")
async def update_settings(req: SettingsUpdate):
    settings = load_settings()
    settings["default_quality"] = req.default_quality
    
    # Save settings.json
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)
    except Exception as e:
        log.error("Failed to save settings: %s", e)
        
    # Save cookies.txt
    if req.cookie_content is not None:
        content = req.cookie_content.strip()
        if content:
            try:
                with open(COOKIES_FILE, "w", encoding="utf-8") as f:
                    f.write(content + "\n")
            except Exception as e:
                log.error("Failed to save cookies: %s", e)
        else:
            # Delete cookies file if empty string is passed
            if COOKIES_FILE.exists():
                try:
                    COOKIES_FILE.unlink()
                except Exception as e:
                    log.error("Failed to delete cookies: %s", e)
                    
    return {"message": "Settings updated successfully"}
