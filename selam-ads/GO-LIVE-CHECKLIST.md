# Selam — Go-Live Checklist (YouTube) + Ad Run

Everything's built and proven. The **only** reliability blocker is connection quality under load. Follow this in order each broadcast.

---

## 0 · Pre-flight — the network (this is the one that matters)
The live died today on **Wi-Fi bufferbloat** (plenty of bandwidth, but latency spiked to seconds under load → stream froze). Fix this first.

- **Plug into wired ethernet** (USB-C/Thunderbolt → Ethernet). Biggest single win.
- Verify it's good:
  ```sh
  networkQuality          # want Responsiveness: Medium/High (NOT "Low"); idle latency < ~100ms
  ping -c 20 8.8.8.8      # want 0% loss, low stddev
  ```
- ❌ If `networkQuality` says **Responsiveness: Low** → do NOT go public; the stream will stutter. Get on a steadier link first.

## 1 · App running + reachable
```sh
curl -s http://127.0.0.1:9222/json/version   # should return a Chrome/version line
```
If not running, relaunch:
```sh
cd ~/.openclaw/workspace/companion/v2/electron-shell
nohup ./node_modules/.bin/electron . > /tmp/selam.log 2>&1 & disown
# wait ~8s, then re-check the curl above
```

## 2 · Go live — UNLISTED test first
```sh
cd ~/selam-live
SELAM_YT_PRIVACY=unlisted node go-live-youtube.mjs
```
- Prints `✅ LIVE → https://www.youtube.com/watch?v=<ID>` — note the ID.
- Baked in automatically: on-brand avatar (warm skin/dark hair), growth-mode welcoming, and **subscribe/follow asks** ("hit subscribe and ring the bell").
- If it looks blue or wrong, the look-fix reapplies every 15s on its own.

## 3 · Confirm it actually HOLDS (the real test)
- **Watch from a second device** — does it stay smooth, or freeze?
- The true health signal is YouTube **ingest health**, not whether processes are alive. If it stutters/freezes within a few minutes → it's the connection (see step 0).
- Let it run ~3–5 min unlisted. Smooth the whole time = good to go public.

## 4 · Flip to PUBLIC (only once stable)
- Easiest: **YouTube Studio → the live → set visibility to Public.**
- (Same stream keeps running — no restart, no new URL.)

## 5 · Run the $10/day YouTube ad (promote her while live)
In **Google Ads → "Selam AI Agent" account**:
1. **New campaign → Video → Video views**
2. Name it **`live-yt`**  *(exact — this is what auto-triggers growth mode)*
3. **$10/day**, Networks → **YouTube**, Locations → **US / Canada / UK / Australia**, Language → **English**
4. A couple interests (AI tools, productivity, entrepreneurs)
5. **Ad video = the live stream URL** (from step 2); **Final URL → `heyselam.ai/yt`**
6. **Publish**

> The moment `live-yt` starts spending, host-loop auto-detects it and **growth mode ramps up** (warmer welcomes, more subscribe/share invites). No flag needed. To force it on manually instead: relaunch step 2 with `SELAM_PROMO_LIVE=1` prefixed.

## 6 · During the broadcast
- She reads **YouTube live chat** and answers viewers by name, out loud.
- Drop a comment yourself to confirm she's responding.
- Attribution: clicks via `heyselam.ai/yt` → `utm_campaign=live-yt` → shows in **HQ Ads tab** (`api.heyselam.app/hq`).

## 7 · End cleanly
```sh
cd ~/selam-live
node end-live.mjs            # ends the broadcast + stops encoder/host-loop
# if end-live.mjs isn't wired for YT, manual teardown:
pkill -9 -f "rtmp://a.rtmp.youtube.com" ; pkill -f "host-loop.mjs"
```
- Then **pause the `live-yt` campaign** in Google Ads so it stops spending.

## 8 · After — harvest + retarget
- Record/rehearse clips for next time: `node ~/selam-ads/live/clip/clip-live.mjs <recording> <start> <dur> <name> [left|center]`
- Build retargeting audiences from the viewers: see `~/selam-ads/live/retargeting-guide.md`.

---

### Known-good settings
- Bitrate: `SELAM_YT_BITRATE` (default 1200k; 800k is lower-demand but won't fix an unstable link).
- The whole pipeline is proven — it went live + public today. The last mile is a steady connection (step 0).
