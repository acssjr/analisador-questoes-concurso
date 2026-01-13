#!/bin/bash
# Auto-start dev servers on SessionStart
# Only starts if ports are not already in use

set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$PROJECT_DIR"

# Read stdin (hook input) and discard - required for hook protocol
cat > /dev/null

# Check if a port is in use
port_in_use() {
    netstat -ano 2>/dev/null | grep -q ":$1 " && return 0
    return 1
}

BACKEND_PORT=8000
FRONTEND_PORT=5173

# Start backend if port 8000 is free
if ! port_in_use $BACKEND_PORT; then
    # Start in background, redirect output to log file
    nohup uv run uvicorn src.api.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT \
        > "$PROJECT_DIR/.claude/cache/backend.log" 2>&1 &
    BACKEND_STARTED=true
else
    BACKEND_STARTED=false
fi

# Start frontend if no vite port is in use (checks 5173-5176)
FRONTEND_RUNNING=false
for port in 5173 5174 5175 5176; do
    if port_in_use $port; then
        FRONTEND_RUNNING=true
        break
    fi
done

if [ "$FRONTEND_RUNNING" = "false" ]; then
    cd "$PROJECT_DIR/frontend"
    nohup npm run dev > "$PROJECT_DIR/.claude/cache/frontend.log" 2>&1 &
    FRONTEND_STARTED=true
    cd "$PROJECT_DIR"
else
    FRONTEND_STARTED=false
fi

# Build status message
MSG=""
if [ "$BACKEND_STARTED" = "true" ] && [ "$FRONTEND_STARTED" = "true" ]; then
    MSG="Dev servers starting (backend:8000, frontend:5173+)"
elif [ "$BACKEND_STARTED" = "true" ]; then
    MSG="Backend starting on :8000 (frontend already running)"
elif [ "$FRONTEND_STARTED" = "true" ]; then
    MSG="Frontend starting (backend already running on :8000)"
fi

# Output hook response
if [ -n "$MSG" ]; then
    echo "{\"result\": \"continue\", \"message\": \"$MSG\"}"
else
    echo "{\"result\": \"continue\"}"
fi
