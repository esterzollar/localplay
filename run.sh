#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  run.sh  –  Start LocalPlay (backend + frontend) with a single command
#
#  Access:  http://localhost:12955
#
#  Usage:
#    ./run.sh          → start everything (kills old instances first)
#    ./run.sh --stop   → stop only
#    ./run.sh --logs   → tail live logs without restarting
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Paths ──────────────────────────────────────────────────────────────────
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$DIR/backend/venv"
LOG_DIR="$DIR/.logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
PID_FILE="$LOG_DIR/localplay.pids"

# ── Colours ────────────────────────────────────────────────────────────────
GRN='\033[0;32m'; RED='\033[0;31m'; CYN='\033[0;36m'; BLD='\033[1m'; RST='\033[0m'
log()  { echo -e "${BLD}${CYN}[LocalPlay]${RST} $*"; }
ok()   { echo -e "${GRN}  ✓${RST} $*"; }
err()  { echo -e "${RED}  ✗${RST} $*"; exit 1; }

# ── Stop all ───────────────────────────────────────────────────────────────
stop_all() {
  if [[ -f "$PID_FILE" ]]; then
    while IFS= read -r pid; do
      kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  pkill -f "uvicorn backend.main" 2>/dev/null || true
  pkill -f "vite"                2>/dev/null || true
  # Force-free ports in case any process is still holding them
  sleep 0.5
  fuser -k 12954/tcp 2>/dev/null || true
  fuser -k 12955/tcp 2>/dev/null || true
  sleep 0.5
}

# ── Argument handling ───────────────────────────────────────────────────────
case "${1:-}" in
  --stop)
    log "Stopping LocalPlay…"
    stop_all
    ok "All stopped."
    exit 0
    ;;
  --logs)
    log "Streaming logs (Ctrl+C to stop tailing — processes keep running):"
    echo -e "${CYN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
    tail -f "$BACKEND_LOG" "$FRONTEND_LOG" 2>/dev/null \
      | awk '
          /==> .*backend/  { tag="\033[0;36m[BACK]  \033[0m"; next }
          /==> .*frontend/ { tag="\033[0;32m[FRONT] \033[0m"; next }
          { print tag $0; fflush() }
        '
    exit 0
    ;;
esac

# ── Banner ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLD}${RED}  ██╗      ██████╗  ██████╗ █████╗ ██╗     ████████╗██╗   ██╗██████╗ ███████╗${RST}"
echo -e "${BLD}${RED}  ██║     ██╔═══██╗██╔════╝██╔══██╗██║        ██║   ██║   ██║██╔══██╗██╔════╝${RST}"
echo -e "${BLD}${RED}  ██║     ██║   ██║██║     ███████║██║        ██║   ██║   ██║██████╔╝█████╗  ${RST}"
echo -e "${BLD}${RED}  ██║     ██║   ██║██║     ██╔══██║██║        ██║   ██║   ██║██╔══██╗██╔══╝  ${RST}"
echo -e "${BLD}${RED}  ███████╗╚██████╔╝╚██████╗██║  ██║███████╗   ██║   ╚██████╔╝██████╔╝███████╗${RST}"
echo -e "${BLD}${RED}  ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚══════╝${RST}"
echo ""

# ── Clean up old instances ─────────────────────────────────────────────────
log "Stopping any existing instances…"
stop_all && ok "Clean slate."

# ── Setup log dir ──────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
> "$BACKEND_LOG"; > "$FRONTEND_LOG"; > "$PID_FILE"

# ── Guard rails ────────────────────────────────────────────────────────────
[[ ! -f "$VENV/bin/activate" ]] && err "Python venv not found at $VENV
  Run:  python3 -m venv $VENV && source $VENV/bin/activate && pip install -r backend/requirements.txt"

command -v npm &>/dev/null || err "npm not found — install Node.js first."

[[ ! -d "$DIR/frontend/node_modules" ]] && {
  log "Installing frontend dependencies…"
  npm install --prefix "$DIR/frontend" --silent && ok "node_modules ready."
}

# ── Backend ────────────────────────────────────────────────────────────────
log "Starting backend (FastAPI) on :12955…"
(
  source "$VENV/bin/activate"
  cd "$DIR"
  exec uvicorn backend.main:app --host 127.0.0.1 --port 12954 --reload \
    >> "$BACKEND_LOG" 2>&1
) &
echo $! >> "$PID_FILE"
ok "Backend started."

# Wait for backend health
log "Waiting for backend…"
for i in $(seq 1 30); do
  curl -sf http://127.0.0.1:12955/api/videos/latest >/dev/null 2>&1 && break
  kill -0 "$(tail -1 "$PID_FILE")" 2>/dev/null || {
    err "Backend crashed. Last log:\n$(tail -20 "$BACKEND_LOG")"
  }
  sleep 0.5
done
ok "Backend is up."

# ── Frontend ───────────────────────────────────────────────────────────────
log "Starting frontend (Vite) on :12955…"
(
  cd "$DIR/frontend"
  exec npm run dev >> "$FRONTEND_LOG" 2>&1
) &
echo $! >> "$PID_FILE"
ok "Frontend started."

# Wait for frontend health
for i in $(seq 1 40); do
  curl -sf http://localhost:12955 >/dev/null 2>&1 && break
  sleep 0.5
done
ok "Frontend is up."

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLD}${GRN}  ┌──────────────────────────────────────┐${RST}"
echo -e "${BLD}${GRN}  │  🌐  http://localhost:12955           │${RST}"
echo -e "${BLD}${GRN}  │  🔧  http://localhost:12955/docs      │${RST}"
echo -e "${BLD}${GRN}  │                                      │${RST}"
echo -e "${BLD}${GRN}  │  Stop:       ./stop.sh  or  Ctrl+C  │${RST}"
echo -e "${BLD}${GRN}  │  Tail logs:  ./run.sh --logs        │${RST}"
echo -e "${BLD}${GRN}  └──────────────────────────────────────┘${RST}"
echo ""

# ── Ctrl+C → clean shutdown ────────────────────────────────────────────────
cleanup() { echo ""; log "Shutting down…"; stop_all; ok "Goodbye."; exit 0; }
trap cleanup INT TERM

# ── Stream merged logs ─────────────────────────────────────────────────────
log "Streaming logs (Ctrl+C to stop everything):"
echo -e "${CYN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RST}"
tail -f "$BACKEND_LOG" "$FRONTEND_LOG" 2>/dev/null \
  | awk '
      /==> .*backend/  { tag="\033[0;36m[BACK]  \033[0m"; next }
      /==> .*frontend/ { tag="\033[0;32m[FRONT] \033[0m"; next }
      { print tag $0; fflush() }
    '
