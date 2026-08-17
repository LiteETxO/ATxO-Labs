#!/usr/bin/env bash
# rec-shot8.sh <seconds> — record the Selam window WITH mic+system audio for the barge-in shot.
set -euo pipefail
S="$(dirname "$0")"
mkdir -p "$S/shots"
DUR="${1:-40}"
# Derive the window crop from the live Electron bounds (2x retina)
read X Y W H <<< $(python3 - <<'PY'
import json, urllib.request, websocket
pages = json.load(urllib.request.urlopen("http://localhost:9222/json", timeout=3))
aria = [p for p in pages if p.get("title") == "Aria"][0]["webSocketDebuggerUrl"]
ws = websocket.create_connection(aria, suppress_origin=True, timeout=10)
ws.send(json.dumps({"id":1,"method":"Runtime.evaluate","params":{"expression":"[window.screenX,window.screenY,window.outerWidth,window.outerHeight].join(' ')","returnByValue":True}}))
while True:
    m=json.loads(ws.recv())
    if m.get("id")==1: print(m["result"]["result"]["value"]); break
PY
)
echo "window at $X,$Y ${W}x${H} — recording ${DUR}s with mic audio"
ffmpeg -hide_banner -loglevel error -f avfoundation -framerate 30 -capture_cursor 1 \
  -i "3:0" -t "$DUR" \
  -vf "crop=$((W*2)):$((H*2)):$((X*2)):$((Y*2))" \
  -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -c:a aac \
  -y "$S/shots/s8-barge.mov"
echo "saved shots/s8-barge.mov"
