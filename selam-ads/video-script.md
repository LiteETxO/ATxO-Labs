# Selam — Video Ad Script (Selam Studio / talking-head)

Format: Selam performs to camera, clean studio look, captioned. Export **9:16** (Reels/Stories/Shorts/TikTok) and **16:9** (YouTube in-stream). End on a brand card with CTA.
Voice: her ElevenLabs voice. Captions on-screen (auto-burned). Angle: **"Runs ops while you sleep."**

---

## :15 cut (primary — best for Reels/Shorts/skippable YouTube)
Lines she speaks (each line = one caption beat):
1. "You sleep. I work."
2. "I'm Selam — an AI operator that lives on your Mac."
3. "Give me the night. Wake up to it done."
4. "Private. Local. Yours."
5. "Meet me — heyselam dot A-I."

End card: **SELAM** mark · "Runs ops while you sleep." · **heyselam.ai** · Start free

---

## :25 cut (fuller story — feed / YouTube)
1. "You sleep. I work."
2. "I'm Selam — an AI operator that lives on your Mac. Not a chatbot. An operator."
3. "Give me tonight's to-do list, and I'll spin up my own team of agents."
4. "I reach people across WhatsApp, email and iMessage — and I report back."
5. "No cloud renting you access to your own assistant. Private, local, and yours to own."
6. "Give me the night. Wake up to it done."
7. "Meet me at heyselam dot A-I."

End card: same as above.

---

## Production notes
- **Hook in 2 seconds:** "You sleep. I work." is the scroll-stopper — keep it first, no logo pre-roll.
- **Captions required:** most feed views are muted; burn captions (the pipeline does this).
- **Pacing:** ~0.4s gap between beats; total 15s / 25s.
- **End card:** 2s hold, brand mark + CTA + URL, on the same dark/periwinkle brand.
- **Attribution:** upload under campaign `yt-overnight` (Google/YouTube) and `meta-overnight-video` (Meta) so spend maps to revenue in HQ.
- **Variants to test later:** swap the hook line per angle — "Own her, don't rent a chatbot." / "She has a face, a voice, a name you choose." reuse the same body.

## How it's produced
Driven via the Selam recording pipeline (`~/selam-ads/produce-video.mjs`): clean studio chrome + brand overlay → `__selamRecorder.start` → she speaks each line (adapter.speak + wait) → `stop` → saved to `~/Movies/Selam Recordings/`, then ffmpeg → mp4 (9:16 and 16:9). Requires the Selam app running with remote debugging on :9222.
