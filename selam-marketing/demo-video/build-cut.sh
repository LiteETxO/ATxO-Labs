#!/usr/bin/env bash
# build-cut.sh — Selam demo video, first cut (screen-demo pipeline, ffmpeg runtime).
# Captions are pre-rendered transparent PNGs (this ffmpeg has no drawtext);
# every clip normalizes to 1920x1080@30 + VO audio, then concat.
set -euo pipefail
S=/private/tmp/claude-501/-Users-michaelderibe/58011b09-a982-430d-9bbf-2e82fea1a4bc/scratchpad
B=$S/build
FF="ffmpeg -hide_banner -loglevel error -y"
ENC="-c:v libx264 -preset veryfast -crf 18 -c:a aac -ar 48000 -ac 2"

# S1: cold open — trim to her speaking, crop off the status row, pillarbox
$FF -ss 10 -t 12 -i $S/shots/s1-cold-open.mov -i $B/cap1.png -i $S/vo/vo1.mp3 \
  -filter_complex "[0:v]crop=1052:1560:0:0,scale=-2:1080,pad=1920:1080:(ow-iw)/2:0:color=0x0b0b12,setsar=1[base];[base][1:v]overlay=0:0,fps=30,format=yuv420p[v];[2:a]apad[a]" \
  -map "[v]" -map "[a]" -t 12 $ENC $B/c1.mp4

# S2: character picker at 1.4x
$FF -ss 2 -i $S/shots/s2-picker.mov -i $B/cap2.png -i $S/vo/vo2.mp3 \
  -filter_complex "[0:v]setpts=PTS/1.4,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b0b12,setsar=1[base];[base][1:v]overlay=0:0,fps=30,format=yuv420p[v];[2:a]apad[a]" \
  -map "[v]" -map "[a]" -t 15 $ENC $B/c2.mp4

# S3: look options (glasses, top, hair) at 1.6x
$FF -ss 1 -i $S/shots/s3-look.mov -i $B/cap3.png -i $S/vo/vo3.mp3 \
  -filter_complex "[0:v]setpts=PTS/1.6,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b0b12,setsar=1[base];[base][1:v]overlay=0:0,fps=30,format=yuv420p[v];[2:a]apad[a]" \
  -map "[v]" -map "[a]" -t 15 $ENC $B/c3.mp4

# S4: slate — walk-away beat
$FF -loop 1 -t 8 -i $B/slate4.png -i $S/vo/vo4.mp3 \
  -filter_complex "[0:v]fps=30,format=yuv420p[v];[1:a]apad[a]" \
  -map "[v]" -map "[a]" -t 8 $ENC $B/c4.mp4

# S5: PDF → deck, real pacing
$FF -ss 11 -t 20 -i $S/shots/s5-deck.mov -i $B/cap5.png -i $S/vo/vo5.mp3 \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b0b12,setsar=1[base];[base][1:v]overlay=0:0,fps=30,format=yuv420p[v];[2:a]apad[a]" \
  -map "[v]" -map "[a]" -t 20 $ENC $B/c5.mp4

# S6: model cards
$FF -ss 2 -t 13 -i $S/shots/s6-models.mov -i $B/cap6.png -i $S/vo/vo6.mp3 \
  -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b0b12,setsar=1[base];[base][1:v]overlay=0:0,fps=30,format=yuv420p[v];[2:a]apad[a]" \
  -map "[v]" -map "[a]" -t 13 $ENC $B/c6.mp4

# S7a: memory view, slow zoom
$FF -loop 1 -t 6 -i $S/asset-memory.png -i $B/cap7.png -i $S/vo/vo7.mp3 \
  -filter_complex "[0:v]scale=2112:1188,zoompan=z='1+0.0007*on':d=180:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30,setsar=1[base];[base][1:v]overlay=0:0,format=yuv420p[v];[2:a]apad[a]" \
  -map "[v]" -map "[a]" -t 6 $ENC $B/c7a.mp4

# S7b: /security page pan (VO7 continues, so keep its tail)
$FF -loop 1 -t 6 -i $S/asset-security.png -i $B/cap7.png -i $S/vo/vo7.mp3 \
  -filter_complex "[0:v]scale=1920:-2,setsar=1,crop=1920:1080:0:'min(ih-1080,(ih-1080)*t/6)'[base];[base][1:v]overlay=0:0,fps=30,format=yuv420p[v];[2:a]atrim=start=6,apad[a]" \
  -map "[v]" -map "[a]" -t 6 $ENC $B/c7b.mp4

# S8: slate — interrupt beat
$FF -loop 1 -t 7 -i $B/slate8.png -i $S/vo/vo8.mp3 \
  -filter_complex "[0:v]fps=30,format=yuv420p[v];[1:a]apad[a]" \
  -map "[v]" -map "[a]" -t 7 $ENC $B/c8.mp4

# S9: landing pan + close card
$FF -loop 1 -t 9 -i $S/asset-landing.png -i $B/cap9.png -i $S/vo/vo9.mp3 \
  -filter_complex "[0:v]scale=1920:-2,setsar=1,crop=1920:1080:0:'min(ih-1080,(ih-1080)*t/9)'[base];[base][1:v]overlay=0:0,fps=30,format=yuv420p[v];[2:a]apad[a]" \
  -map "[v]" -map "[a]" -t 9 $ENC $B/c9.mp4

: > $B/list.txt
for c in c1 c2 c3 c4 c5 c6 c7a c7b c8 c9; do echo "file '$B/$c.mp4'" >> $B/list.txt; done
$FF -f concat -safe 0 -i $B/list.txt -c copy $S/selam-demo-firstcut.mp4
ffprobe -v error -show_entries format=duration,size -of default=nw=1 $S/selam-demo-firstcut.mp4
echo BUILD OK