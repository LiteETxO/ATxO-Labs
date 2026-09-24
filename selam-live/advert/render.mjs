// render.mjs — record ad.html to a webm (1080x1920), then we transcode to mp4.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
const { chromium } = pkg;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DUR = Number(process.argv[2] || 34500);

const recDir = path.join(ROOT, "rec");
fs.rmSync(recDir, { recursive: true, force: true });
fs.mkdirSync(recDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--force-color-profile=srgb", "--hide-scrollbars"] });
const ctx = await browser.newContext({
  viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1,
  recordVideo: { dir: recDir, size: { width: 1080, height: 1920 } },
});
const page = await ctx.newPage();
await page.goto("file://" + path.join(ROOT, "ad.html"), { waitUntil: "load" });
try { await page.evaluate(() => document.fonts.ready); } catch (_) {}
await page.waitForTimeout(1500);   // let the recorder warm up (drops first frames) while animations are paused
await page.evaluate(() => { const g = document.getElementById("pausegate"); if (g) g.remove(); });   // start all animations from t=0
console.log("recording", DUR, "ms …");
await page.waitForTimeout(DUR);
await ctx.close();   // finalizes the video file
await browser.close();
const f = fs.readdirSync(recDir).find((x) => x.endsWith(".webm"));
console.log("VIDEO:", f ? path.join(recDir, f) : "(none)");
