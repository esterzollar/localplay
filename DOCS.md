# LocalPlay - Technical Documentation

Welcome to the internal workings of **LocalPlay**. If you're looking to poke around under the hood, tweak the code, or build new features, you're in the right place. 

This guide breaks down how the frontend and backend talk to each other, how data is stored, and where you can find specific logic.

---

## Architecture at a Glance

LocalPlay is split into two distinct halves that run alongside each other:
- **The Engine (Backend):** A Python/FastAPI app that talks to our SQLite database (`localplay.db`). It lives in the `backend/` folder and natively runs on port `12954`.
- **The Interface (Frontend):** A React app built with Vite. It lives in the `frontend/` folder and is served on port `12955`. It proxies all API calls back to the Engine seamlessly.

---

## The Engine (`backend/`)

We chose **FastAPI** because it's blazing fast and handles async tasks beautifully. We use **SQLAlchemy** to talk to the database and **Pydantic** to make sure the data flowing in and out is perfectly shaped.

### Where is the data? (`backend/models.py`)
This is where our SQLite database schema is defined. 
* **`Video`**: The heart of the app. Stores metadata (title, duration, path).
* **`Playlist`**: Groups of videos.
* **`StudyNote`**: Your personal, time-stamped annotations.
* **`VocabularyWord` & `VocabularyBoard`**: Flashcards tied to video timestamps.
* **`VideoInteraction`**: Used by our custom algorithm to track your watch time and behavior.

### How does the app do things?
* **`downloader.py`**: This is our custom wrapper around `yt-dlp`. It manages background threads to pull down videos, subtitles, and thumbnails without locking up the app.
* **`media_scanner.py`**: A neat utility that watches your `/media` folder. If you manually drop an `.mp4` in there, the scanner will automatically detect it and add it to the database.

### The API Endpoints (Routers)
Instead of one massive file, we broke the API down into smaller, focused "routers". You can explore them interactively by visiting `http://localhost:12954/docs` when the app is running.
* **`router_videos.py`**: Handling the main video feed, searching, and deleting.
* **`router_stream.py`**: The magic that chunks local video files so your browser can stream them smoothly (HTTP 206 Partial Content).
* **`router_download.py`**: Endpoints for queuing new downloads and checking progress.
* **`router_algorithms.py`**: The logic that logs watch time and generates custom recommendations.
* **`router_notes.py` & `router_vocabulary.py`**: Endpoints dedicated to the educational features of LocalPlay.

---

## The Interface (`frontend/`)

The frontend is a snappy **React 18** app. We didn't want the overhead of Redux, so we rely on React's native Hooks and Context, styled with clean, vanilla CSS.

### Key Components (`src/components/`)
* **`App.jsx`**: The main shell. It handles the layout (Sidebar, TopBar) and routing.
* **`WatchPage.jsx` & `VideoPlayer.jsx`**: Where you actually watch the videos. We built a heavily customized HTML5 video player to support custom VTT subtitles and keyboard shortcuts.
* **`VideoGrid.jsx`**: The responsive masonry layout you see on the home screen.
* **`ShortsPage.jsx`**: A specialized, TikTok-style vertical feed for short-form content.

### Custom Hooks (`src/hooks/`)
* **`useWatchProgress.js`**: Automatically remembers where you left off in a video.
* **`useFavourites.js`**: A simple way to manage your liked videos across the app.
* **`useAutoRefresh.js`**: Keeps the UI up-to-date while background downloads are processing.

---

## Running the Show

We built a single script to rule them all: **`run.sh`**. 

When you execute `./run.sh`, it:
1. Double-checks that your Python environment and Node dependencies are ready.
2. Clears out any old processes that might be stuck on our ports (`12954` and `12955`).
3. Boots up both the backend and frontend in the background.
4. Streams a color-coded log output to your terminal so you can see exactly what both sides of the app are doing in real-time.

To gracefully shut everything down, just press `Ctrl+C` or run `./stop.sh`.

---

## A Note on Licensing

LocalPlay is released under the **LocalPlay Public License (LPL)**. 

We love open source, and we want individuals, hobbyists, and educators to use and modify this tool freely. The only catch is that **profitable or commercial use is strictly prohibited** without permission. If you use our code, please give credit where credit is due (Ester Zollar and LocalPlay). You are not forced to open-source your own modifications, as long as you respect the non-profit and attribution rules. 

See the `LICENSE` file for the exact legal wording.