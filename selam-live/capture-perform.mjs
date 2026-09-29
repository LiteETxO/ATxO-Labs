// capture-perform.mjs — Selam performs the ad script VERBATIM on her regular live
// broadcast setup (brand + ticker overlay, clean chrome), recorded locally. No stream.
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
const { chromium } = pkg;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LINES = [
  "Tired of news jargon and endless noise? Meet your new anchor — me. I'm an AI, and I host live.",
  "Real news, market moves, only what actually matters — in plain English, or your language.",
  "Comment and I answer you live. I run trivia, I roast the trolls, and I never sleep.",
  "So come hang out — hit subscribe, and I'll bring you the news you actually care about. See you live.",
];
const CLEAN_CSS = "body.studio-clean #drag-handle,body.studio-clean #status,body.studio-clean #session-controls,body.studio-clean #transcript-panel,body.studio-clean #settings-btn,body.studio-clean #projects-toggle,body.studio-clean #selam-avatar-logo,body.studio-clean #avatar-placeholder,body.studio-clean #net-banner,body.studio-clean #network-quality-pill,body.studio-clean #inflight-chips,body.studio-clean #debug-controls,body.studio-clean #inflight-tasks,body.studio-clean #completed-tasks,body.studio-clean #settings-panel,body.studio-clean #settings-backdrop,body.studio-clean #projects-panel,body.studio-clean #lesson-panel,body.studio-clean #working-indicator,body.studio-clean #selam-toast-stack,body.studio-clean #text-input,body.studio-clean #speak-btn,body.studio-clean #composer,body.studio-clean #input-row,body.studio-clean #input-wrap,body.studio-clean #mute-btn,body.studio-clean #start-btn{display:none !important}body.studio-clean #avatar-container{border-radius:0 !important}body.studio-clean{background:#0a0c13 !important}";

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
let pg = null;
for (const c of b.contexts()) for (const p of c.pages()) { if (p.url().startsWith("devtools://")) continue; try { if (await p.evaluate(() => !!document.getElementById("text-input"))) { pg = p; break; } } catch (_) {} }
if (!pg) { console.log("no app page"); process.exit(1); }

// ensure a live session
if (!(await pg.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive())))) {
  await pg.evaluate(() => { const s = document.getElementById("start-btn"); if (s) s.click(); });
  for (let i = 0; i < 25; i++) { await sleep(700); if (await pg.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive()))) break; }
  await sleep(1500);
}
// mute the mic so it never picks up room noise
try { await pg.evaluate(() => { const m = document.getElementById("mute-btn"); if (m && document.body.classList.contains("mic-listening")) m.click(); }); } catch (_) {}

// broadcast look: clean chrome + brand/ticker overlay, avatar CENTERED (solo, no side card)
await pg.evaluate((css) => {
  if (!document.getElementById("selam-bcast-clean")) { const st = document.createElement("style"); st.id = "selam-bcast-clean"; st.textContent = css; document.head.appendChild(st); }
  document.body.classList.add("studio-clean");
  const ac = document.getElementById("avatar-container"); if (ac) ac.style.transform = "";   // centered
  try { window.__selamLive && window.__selamLive.startOverlay && window.__selamLive.startOverlay(); } catch (_) {}
}, CLEAN_CSS);
await sleep(1000);

// completion wait for a spoken line
const capState = () => pg.evaluate(() => { const a = window.__selamAdapter, av = a && a.avatar; return { f: av ? (av.speakingFactor || 0) : 0, q: (a && a._speakQueue && a._speakQueue.length) || 0, spk: !!(a && a.speaking) }; });
async function waitDone() {
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) { const s = await capState(); if (s.f > 0.06 || s.q > 0 || s.spk) break; await sleep(150); }
  let quiet = 0;
  while (Date.now() - t0 < 60000) { const s = await capState(); if (s.f < 0.06 && s.q === 0 && !s.spk) { if (++quiet >= 8) break; } else quiet = 0; await sleep(120); }
}

const rec = await pg.evaluate(() => window.__selamRecorder && window.__selamRecorder.start ? window.__selamRecorder.start({ scope: "window" }) : { ok: false });
console.log("recorder:", JSON.stringify(rec));
const recT0 = Date.now();
await sleep(1200);   // opening breath

const marks = [];
for (const line of LINES) {
  marks.push(((Date.now() - recT0) / 1000).toFixed(2));
  await pg.evaluate((t) => { try { window.__selamAdapter.speak(t); } catch (_) {} }, line);
  await waitDone();
  await sleep(450);
}
await sleep(1200);
const out = await pg.evaluate(() => window.__selamRecorder && window.__selamRecorder.stop ? window.__selamRecorder.stop() : { ok: false });
try { await pg.evaluate(() => window.__selamLive && window.__selamLive.stopOverlay && window.__selamLive.stopOverlay()); } catch (_) {}
console.log("SAVED:", JSON.stringify(out));
console.log("LINE_MARKS:", JSON.stringify(marks));
await b.close();
