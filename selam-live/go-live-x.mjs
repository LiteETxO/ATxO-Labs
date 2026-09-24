// go-live-x.mjs — take Selam live on X (Twitter) via RTMP.
//
// X has no simple public "create broadcast" API (Periscope was retired), so the
// broadcast is created in X Media Studio → Producer, which hands you an RTMP
// server URL + stream key. We just push the encoder to that endpoint (same
// encode path as Facebook/YouTube). You then click "Go Live" in Media Studio
// once it shows the stream as healthy, and attach it to a post.
//
// SETUP (once): in ~/selam-live/.env set
//   SELAM_X_URL=rtmp://<server-from-media-studio>/<stream-key>
//   (optionally SELAM_X_BITRATE=2500k)
//
//   node go-live-x.mjs        (needs the app running in dev mode, CDP 9222)
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
const { chromium } = pkg;

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const l of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const X_URL = (process.env.SELAM_X_URL || "").trim();
const BITRATE = process.env.SELAM_X_BITRATE || "2500k";
if (!X_URL) {
  console.error("✗ SELAM_X_URL not set in ~/selam-live/.env.\n" +
    "  Create the broadcast in X → Media Studio → Producer (RTMP source), then set:\n" +
    "  SELAM_X_URL=rtmp://<server>/<stream-key>");
  process.exit(1);
}

(async () => {
  console.log(`① connecting encoder → X @${BITRATE} …`);
  // Kill any stale pusher to this endpoint before reconnecting.
  try { execSync("pkill -9 -f 'go-live-x'", { stdio: "ignore" }); } catch (_) {}
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
  let page = null;
  for (const c of b.contexts()) for (const p of c.pages()) {
    if (await p.evaluate(() => !!(window.__selamLive && window.__selamLive.start)).catch(() => 0)) { page = p; break; }
  }
  if (!page) { await b.close(); throw new Error("app not running / CDP 9222 unavailable — launch the app in dev mode first"); }

  // Open a session BEFORE the encoder captures, so the app's personalized owner
  // greeting plays OFF-air (the host-loop's on-air welcome greets viewers).
  const hadSession = await page.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive()));
  if (!hadSession) {
    console.log("   opening session off-air (so the owner greeting isn't broadcast)…");
    await page.evaluate(() => { const s = document.getElementById("start-btn"); if (s) s.click(); });
    for (let i = 0; i < 15; i++) { await sleep(600); if (await page.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive()))) break; }
    await sleep(2500);
  }
  await page.evaluate(async () => { try { await window.__selamLive.stop(); } catch (_) {} });
  await sleep(1000);
  const res = await page.evaluate(async ({ u, br }) => await window.__selamLive.start(u, { music: true, overlay: true, bitrate: br }), { u: X_URL, br: BITRATE });
  await b.close();
  if (!res || !res.ok) throw new Error("encoder start failed: " + (res && res.error));
  console.log("   encoder up — pushing to X.");

  console.log("② starting host-loop (content + on-air welcome) …");
  try { execSync("pkill -f 'host-loop.mjs'", { stdio: "ignore" }); } catch (_) {}
  await sleep(800);
  const out = fs.openSync(path.join(ROOT, "host-loop.log"), "a");
  // X has no simple live-chat API, so the chat loop is off; content + news run.
  spawn("node", ["host-loop.mjs"], { cwd: ROOT, stdio: ["ignore", out, out], detached: true, env: { ...process.env, SELAM_CHAT_PLATFORM: "none" } }).unref();

  console.log("\n✅ Streaming to X. Now open X → Media Studio → Producer, confirm the stream is healthy, and click GO LIVE (then attach it to a post).");
})().catch((e) => { console.error("✗ go-live-x failed:", e.message); process.exit(1); });
