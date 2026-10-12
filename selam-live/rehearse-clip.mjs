// rehearse-clip.mjs — SHORT local rehearsal (2 min, no stream) recorded for ad
// clips, with the brand avatar look locked (warm skin / dark hair) so the
// capture isn't the cold-blue default. host-loop records + saves itself.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
const { chromium } = pkg;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOT = "/Users/michaelderibe/selam-live";
const MOCK = path.join(ROOT, "mock-comments.txt");
fs.writeFileSync(MOCK, "");

// shorter comment timeline for a 2-min run
const drips = [
  [22, "Marcus|wait — this is an actual AI hosting a LIVE show?? that's wild"],
  [55, "Dana|can you really run my email and calendar for me?"],
  [88, "t0aster_boy|boooring 🥱 my microwave has more personality"],
  [108, "Priya|ok lol this is actually kind of amazing"],
];
for (const [t, line] of drips) setTimeout(() => { try { fs.appendFileSync(MOCK, line + "\n"); console.log(`💬 @${t}s: ${line}`); } catch (_) {} }, t * 1000);

// connect + session on + lock the look
const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
let pg = null;
for (const c of b.contexts()) for (const p of c.pages()) { try { if (await p.evaluate(() => !!document.getElementById("text-input"))) { pg = p; break; } } catch (_) {} }
if (!pg) { console.log("no app page on 9222"); process.exit(1); }
if (!(await pg.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive())))) {
  await pg.evaluate(() => { const s = document.getElementById("start-btn"); if (s) s.click(); });
  for (let i = 0; i < 25; i++) { await sleep(700); if (await pg.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive()))) break; }
  await sleep(1200);
}
async function fixLook() {
  await pg.evaluate(() => {
    const av = window.__selamAdapter && window.__selamAdapter.avatar; if (!av) return;
    try { av.setAmbientEnabled && av.setAmbientEnabled(false); } catch (_) {}
    try { av.setSkinColor && av.setSkinColor("#e8c3a0"); } catch (_) {}
    try { av.setHairColor && av.setHairColor("#241a14"); } catch (_) {}
    try { av.setTopColor && av.setTopColor("#2b3350"); } catch (_) {}
    try { const sc = av.scene || av._scene; (sc && sc.children || []).forEach((l) => { if (l.type === "DirectionalLight" && l.color && l.color.getHexString && l.color.getHexString() === "9bb6ff") { l.color.set("#dfe6ff"); l.intensity = 0.16; } }); } catch (_) {}
  });
}
await fixLook();
console.log("look locked, session on — starting rehearsal");

const env = { ...process.env, SELAM_REHEARSE: "1", SELAM_CHAT_PLATFORM: "mock", SELAM_LIVE_MINUTES: "2" };
const child = spawn("node", ["host-loop.mjs"], { cwd: ROOT, env, stdio: "inherit" });

// keep the look locked across the take (host-loop/segments may re-tint)
const iv = setInterval(fixLook, 12000);
child.on("exit", async (code) => { clearInterval(iv); try { await b.close(); } catch (_) {} console.log("host-loop exited", code); process.exit(code || 0); });
