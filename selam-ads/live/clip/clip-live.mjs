// clip-live.mjs — turn a live/rehearsal recording into a vertical (9:16) ad clip:
// center-crop to 9:16, scale to 1080x1920, composite the LIVE brand overlay.
// Usage: node clip-live.mjs <src.webm|mp4> <startSec> <durSec> [outName]
//   e.g. node clip-live.mjs "~/Movies/Selam Recordings/selam-....webm" 42 14 best-moment
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const { chromium } = pkg;

const dir = "/Users/michaelderibe/selam-ads/live/clip";
const [src, start = "0", dur = "15", outName = "live-clip", pos = "center"] = process.argv.slice(2);
// Selam sits CENTER in pure talking-head moments, but PRESENTER-LEFT when a
// news/topic card is on the right. Crop toward where she is.
const cropX = pos === "left" ? "(iw*0.03)" : "(iw-ih*9/16)/2";
if (!src) { console.log("usage: node clip-live.mjs <src> <startSec> <durSec> [outName]"); process.exit(1); }
const SRC = src.replace(/^~/, process.env.HOME);
if (!fs.existsSync(SRC)) { console.log("source not found:", SRC); process.exit(1); }

// 1) render the brand overlay to a transparent PNG (once per run)
const OV = `${dir}/overlay-9x16.png`;
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const pg = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await pg.goto(`file://${dir}/overlay-9x16.html`, { waitUntil: "networkidle" });
await pg.screenshot({ path: OV, omitBackground: true });
await b.close();
console.log("overlay rendered");

// 2) crop→scale→overlay with ffmpeg
const out = `${dir}/${outName}-9x16.mp4`;
execFileSync("ffmpeg", [
  "-y", "-ss", String(start), "-t", String(dur), "-i", SRC, "-i", OV,
  "-filter_complex",
  `[0:v]crop=ih*9/16:ih:${cropX}:0,scale=1080:1920,setsar=1[v];[v][1:v]overlay=0:0:format=auto[o]`,
  "-map", "[o]", "-map", "0:a?",
  "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
  "-movflags", "+faststart", out,
], { stdio: ["ignore", "ignore", "inherit"] });
console.log("SAVED:", out);
