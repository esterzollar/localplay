from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MEDIA_DIR = BASE_DIR / "media"
DB_PATH = BASE_DIR / "localplay.db"

# Ensure media directory exists
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

def get_ytdlp_base_opts() -> dict:
    """Return base yt-dlp options."""
    cookies_file = BASE_DIR / "backend" / "cookies.txt"
    opts = {
        'outtmpl': str(MEDIA_DIR / '%(uploader)s' / '%(title)s.%(ext)s'),
        'format': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
        'merge_output_format': 'mp4',
        'writethumbnail': True,
        'writeinfojson': True,
        'extractflat': False,
        'postprocessors': [{
            'key': 'FFmpegMetadata',
            'add_chapters': True,
        }],
    }
    if cookies_file.exists():
        opts['cookiefile'] = str(cookies_file)
    return opts
