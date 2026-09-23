// end-live.mjs — end Selam's Facebook Live cleanly and unattended.
// Stops the supervisor FIRST (so it can't auto-recover), then the host-loop,
// stops the app stream via CDP (__selamLive.stop — leaves Live Host Mode,
// stops music/overlay), ends the FB broadcast, and kills any stray ffmpeg.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
const { chromium } = pkg;

const ROOT = "/Users/michaelderibe/selam-live";
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const T = process.env.SELAM_FB_TOKEN, S = process.env.FB_APP_SECRET, V = process.env.SELAM_FB_VIDEO;
const proof = S ? crypto.createHmac("sha256", S).update(T).digest("hex") : "";
const kill = (pat) => spawnSync("pkill", ["-f", pat]);

// 1. Stop the supervisor so it will NOT auto-recover, then the host-loop.
kill("supervisor.mjs");
kill("host-loop.mjs");
console.log("stopped supervisor + host-loop");

// 2. Stop the app stream (recorder + ffmpeg, leave Live Host Mode).
try {
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
  let page = null;
  for (const c of b.contexts()) for (const p of c.pages()) {
    if (await p.evaluate(() => !!(window.__selamLive)).catch(() => 0)) { page = p; break; }
  }
  if (page) {
    const r = await page.evaluate(async () => { try { return await window.__selamLive.stop(); } catch (e) { return { err: e.message }; } });
    console.log("__selamLive.stop:", JSON.stringify(r));
    // Undo the host-loop's broadcast stage layout so the normal app returns to
    // its usual size/shape. setupStageLayout() widens the stage to 100%, paints
    // the app/stage backgrounds navy, shifts + zooms the avatar, and drops a
    // news card into the DOM — none of which the window-size restore reverts, so
    // without this the app keeps an empty live-only extension after the show.
    const rl = await page.evaluate(() => {
      try {
        document.body.classList.remove("studio-clean");
        ["stage-row", "session-content", "app"].forEach((id) => {
          const e = document.getElementById(id); if (!e) return;
          e.style.background = ""; e.style.width = ""; e.style.maxWidth = "";
          e.style.display = ""; e.style.justifyContent = ""; e.style.alignItems = "";
        });
        const ov = document.getElementById("selam-live-overlay");
        if (ov) { ov.style.left = ""; ov.style.right = ""; ov.style.width = ""; ov.style.display = "none"; }
        const card = document.getElementById("slo-newsimg"); if (card) card.remove();
        const prices = document.getElementById("slo-prices"); if (prices) prices.remove();
        const ac = document.getElementById("avatar-container");
        if (ac) { ac.style.background = ""; ac.style.transform = ""; }
        try {
          const c = window.__selamAdapter && window.__selamAdapter.avatar && window.__selamAdapter.avatar.camera;
          if (c) { c.position.z = 1.5; c.position.y = 1.55; if (c.updateProjectionMatrix) c.updateProjectionMatrix(); }
        } catch (_) {}
        window.dispatchEvent(new Event("resize"));
        return "restored";
      } catch (e) { return "restore-err:" + e.message; }
    });
    console.log("stage layout:", rl);
  } else console.log("(no app page — stream may already be stopped)");
  await b.close();
} catch (e) { console.log("(CDP unavailable:", e.message + ")"); }

// 3. End the FB broadcast.
if (V && T) {
  try {
    const body = new URLSearchParams({ end_live_video: "true", access_token: T });
    if (proof) body.set("appsecret_proof", proof);
    const j = await (await fetch(`https://graph.facebook.com/v21.0/${V}`, { method: "POST", body })).json();
    console.log("end_live_video:", JSON.stringify(j));
  } catch (e) { console.log("(end_live_video failed:", e.message + ")"); }
}

// 4. Kill any lingering pusher.
kill("rtmps://live-api-s.facebook.com");
console.log("✅ live ended");
