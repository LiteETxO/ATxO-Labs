# Mission Control — start all services
# Usage: ./start.sh

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting Mission Control..."

# Kill any stale processes and free ports
pkill -f "python app.py" 2>/dev/null || true
pkill -f "vite preview" 2>/dev/null || true
lsof -ti :8765 | xargs kill -9 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
sleep 2

# Backend — with auto-restart loop
echo "→ Starting backend (port 8765)..."
cd "$DIR/backend"
while true; do
  .venv/bin/python app.py >> /tmp/mc-backend.log 2>&1
  echo "Backend crashed — restarting in 3s..." >> /tmp/mc-backend.log
  sleep 3
done &
BACKEND_PID=$!
sleep 3

# Frontend preview with API base
echo "→ Starting frontend (port 3000)..."
cd "$DIR/frontend"
VITE_API_BASE=http://localhost:8765 node_modules/.bin/vite preview --port 3000 --host 0.0.0.0 &
FRONTEND_PID=$!
sleep 2

# Cloudflare named tunnel (permanent)
echo "→ Starting Cloudflare tunnel..."
TUNNEL_TOKEN="eyJhIjoiNDY1M2U5ZDgwMDljMjg4OGZmNmJjYjRhNGMzZWYxMWUiLCJ0IjoiMDJkMGMzOTctMWQwMy00OTE0LWFiNDgtYWJiYjQ3NDA3ZjM5IiwicyI6IjZVNlRTdlZZV1VUcmRZUHErTDJhQzZBMEJrcGlUVTFURjF3L1ZYR1BHU2R1dFRPVmVMcG4zVUw3c2RydWs3R1lsTC8zVlh2VVhBeWk3SWM5YndoaXN3PT0ifQ=="
cloudflared tunnel run --token "$TUNNEL_TOKEN" 2>&1 | tee /tmp/mc-tunnel.log &
TUNNEL_PID=$!
sleep 6

echo ""
echo "✅ Mission Control is live!"
echo ""
echo "  Local:   http://localhost:3000"
echo "  Network: http://192.168.0.167:3000"
echo "  Phone:   https://mc.atxo.me  ← permanent URL"
echo ""
echo "PIDs: backend=$BACKEND_PID frontend=$FRONTEND_PID tunnel=$TUNNEL_PID"
echo "To stop: kill $BACKEND_PID $FRONTEND_PID $TUNNEL_PID"

wait
