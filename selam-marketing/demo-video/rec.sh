#!/usr/bin/env bash
# rec.sh <name> <seconds> — record the Selam window region to shots/<name>.mov
# Window pinned at (60,33) 526x893 pt → pixel crop 1052x1786 at (120,66).
set -euo pipefail
S=/private/tmp/claude-501/-Users-michaelderibe/58011b09-a982-430d-9bbf-2e82fea1a4bc/scratchpad
mkdir -p "$S/shots"
NAME="$1"; DUR="$2"
ffmpeg -hide_banner -loglevel error -f avfoundation -framerate 30 -capture_cursor 1 \
  -i "3:none" -t "$DUR" \
  -vf "crop=1052:1786:120:66" \
  -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p \
  -y "$S/shots/$NAME.mov" &
echo $! > "$S/rec.pid"
