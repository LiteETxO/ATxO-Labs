#!/usr/bin/env python3
# Trim TTS-latency dead air from the recording, keeping speech + a tight pad
# and the end-card tail. Captions are burned into frames so they stay synced.
import re, subprocess, sys

SRC = sys.argv[1]
OUT = sys.argv[2]
PAD_L, PAD_R = 0.14, 0.22      # padding around each speech block
MAX_GAP = 0.26                 # cap the pause kept between blocks
TAIL = 2.8                     # seconds of end-card to keep at the end

# 1) silence map
p = subprocess.run(["ffmpeg", "-i", SRC, "-af", "silencedetect=noise=-32dB:d=0.4", "-f", "null", "-"],
                   capture_output=True, text=True)
log = p.stderr
total = 0.0
m = re.findall(r"time=(\d+):(\d+):([\d.]+)", log)
if m:
    h, mi, s = m[-1]; total = int(h)*3600 + int(mi)*60 + float(s)
sil = []
cur = None
for line in log.splitlines():
    a = re.search(r"silence_start:\s*(-?[\d.]+)", line)
    b = re.search(r"silence_end:\s*([\d.]+)", line)
    if a: cur = max(0.0, float(a.group(1)))
    if b and cur is not None: sil.append((cur, float(b.group(1)))); cur = None
if cur is not None: sil.append((cur, total))

# 2) speech = complement of silence
speech = []
t = 0.0
for s0, s1 in sil:
    if s0 - t > 0.1: speech.append((t, s0))
    t = max(t, s1)
if total - t > 0.1: speech.append((t, total))
# drop the end-card tail region from speech (we add it separately), drop tiny bits
speech = [(a, b) for (a, b) in speech if (b - a) >= 0.12 and a < total - TAIL - 0.3]

# 3) pad + merge
blocks = []
for a, b in speech:
    a = max(0.0, a - PAD_L); b = b + PAD_R
    if blocks and a - blocks[-1][1] <= MAX_GAP:
        blocks[-1] = (blocks[-1][0], b)
    else:
        blocks.append((a, b))
# 4) end-card tail
blocks.append((max(total - TAIL, blocks[-1][1] + 0.05), total))

dur = sum(b - a for a, b in blocks)
print(f"kept {len(blocks)} blocks, {dur:.1f}s (from {total:.1f}s)")
for a, b in blocks: print(f"  {a:.2f}-{b:.2f} ({b-a:.2f})")

# 5) build filter_complex trim/atrim + concat
parts, labels = [], []
for i, (a, b) in enumerate(blocks):
    parts.append(f"[0:v]trim={a:.3f}:{b:.3f},setpts=PTS-STARTPTS[v{i}]")
    parts.append(f"[0:a]atrim={a:.3f}:{b:.3f},asetpts=PTS-STARTPTS[a{i}]")
    labels.append(f"[v{i}][a{i}]")
fc = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(blocks)}:v=1:a=1[v][a]"
cmd = ["ffmpeg", "-y", "-i", SRC, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
       "-vf", None,  # placeholder removed below
       "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
       "-movflags", "+faststart", OUT]
cmd = [c for c in cmd if c not in ("-vf", None)]
r = subprocess.run(cmd, capture_output=True, text=True)
print("OK" if r.returncode == 0 else "FFMPEG ERR:\n" + r.stderr[-800:])
