#!/usr/bin/env bash
# assemble.sh <framedir> <out.mov> — frames + times.txt → timestamped video.
# Screencast frames arrive at compositor rate (uneven), so build a concat
# list with real per-frame durations instead of assuming constant fps.
set -euo pipefail
DIR="$1"; OUT="$2"
python3 - "$DIR" <<'EOF'
import sys, os
d = sys.argv[1]
times = [float(x) for x in open(os.path.join(d, "times.txt")) if x.strip()]
frames = sorted(f for f in os.listdir(d) if f.startswith("frame-"))
assert len(frames) == len(times), f"{len(frames)} frames vs {len(times)} times"
durs = [times[i+1] - times[i] for i in range(len(times) - 1)]
durs.append(sum(durs) / len(durs) if durs else 0.033)
with open(os.path.join(d, "list.txt"), "w") as f:
    for fr, du in zip(frames, durs):
        f.write(f"file '{fr}'\nduration {max(du, 0.001):.6f}\n")
    f.write(f"file '{frames[-1]}'\n")
EOF
# Window can resize mid-shot (settings panel widens it) — normalize all
# frames to the largest even dimensions, padding with black.
DIMS=$(python3 - "$DIR" <<'EOF'
import sys, os, struct
d = sys.argv[1]
mw = mh = 0
for f in sorted(os.listdir(d)):
    if not f.startswith("frame-"): continue
    with open(os.path.join(d, f), "rb") as fh:
        data = fh.read(65536)
    i = 2
    while i < len(data) - 9:
        if data[i] != 0xFF: i += 1; continue
        m = data[i+1]
        if m in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data[i+5:i+9])
            mw, mh = max(mw, w), max(mh, h)
            break
        seglen = struct.unpack(">H", data[i+2:i+4])[0]
        i += 2 + seglen
print(f"{mw - mw % 2}:{mh - mh % 2}")
EOF
)
W="${DIMS%%:*}"; H="${DIMS##*:}"
ffmpeg -hide_banner -loglevel error -f concat -safe 0 -i "$DIR/list.txt" \
  -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2" \
  -fps_mode vfr -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 18 \
  -y "$OUT"
echo "assembled: $OUT ($(ls "$DIR" | grep -c '^frame-') frames)"
