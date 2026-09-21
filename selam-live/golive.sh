#!/usr/bin/env bash
# golive.sh — stream the Selam avatar to an RTMP(S) destination (Facebook Live, a
# local test server, Restream, etc.). Facebook requires an audio track, so a
# silent track is added when no audio device is given.
#
#   ./golive.sh "rtmps://live-api-s.facebook.com:443/rtmp/<STREAM-KEY>"     # Facebook Live
#   ./golive.sh "rtmp://localhost:1935/selam"                               # local test (mediamtx)
#
# Env:
#   SELAM_SCREEN  avfoundation video index (default 3 = "Capture screen 0";
#                 run: ffmpeg -f avfoundation -list_devices true -i "" )
#   SELAM_AUDIO   avfoundation audio index (e.g. a BlackHole device capturing the
#                 app's output) — REQUIRED for her voice to be heard on the stream
#   SELAM_CROP    "w:h:x:y" to crop to just the Selam window (else full screen)
#   SELAM_BV      video bitrate (default 4000k)
set -euo pipefail
DEST="${1:?usage: golive.sh <rtmp-url>}"
FF=/opt/homebrew/bin/ffmpeg
SCREEN="${SELAM_SCREEN:-3}"; AUDIO="${SELAM_AUDIO:-}"; BV="${SELAM_BV:-4000k}"
VF="scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0a0c13,fps=30"
[ -n "${SELAM_CROP:-}" ] && VF="crop=${SELAM_CROP},${VF}"
COMMON=(-vf "$VF" -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p
        -g 60 -keyint_min 60 -b:v "$BV" -maxrate "$BV" -bufsize 8000k
        -c:a aac -b:a 128k -ar 44100 -f flv "$DEST")
echo "▸ Streaming to $DEST (Ctrl+C to stop)"
if [ -n "$AUDIO" ]; then
  exec "$FF" -hide_banner -f avfoundation -capture_cursor 0 -framerate 30 -i "${SCREEN}:${AUDIO}" "${COMMON[@]}"
else
  echo "  (no SELAM_AUDIO set — streaming SILENT audio; set SELAM_AUDIO for her voice)"
  exec "$FF" -hide_banner -f avfoundation -capture_cursor 0 -framerate 30 -i "$SCREEN" -f lavfi -i "anullsrc=r=44100:cl=stereo" "${COMMON[@]}"
fi
