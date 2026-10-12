// Produce the Selam :15 video ad — she performs the script to camera, clean
// studio look, synced captions burned in, brand end-card, recorded locally.
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
const { chromium } = pkg;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LINES = [
  "You sleep. I work.",
  "I'm Selam — an AI operator that lives on your Mac.",
  "Give me the night. Wake up to it done.",
  "Private. Local. Yours.",
  "Meet me — hey Selam, dot A-I.",
];
const CAPTIONS = [
  "You sleep. I work.",
  "An AI operator on your Mac.",
  "Give me the night.\nWake up to it done.",
  "Private. Local. Yours.",
  "heyselam.ai",
];

const CLEAN = "body.studio-clean #drag-handle,body.studio-clean #status,body.studio-clean #session-controls,body.studio-clean #transcript-panel,body.studio-clean #settings-btn,body.studio-clean #projects-toggle,body.studio-clean #selam-avatar-logo,body.studio-clean #avatar-placeholder,body.studio-clean #net-banner,body.studio-clean #network-quality-pill,body.studio-clean #inflight-chips,body.studio-clean #debug-controls,body.studio-clean #inflight-tasks,body.studio-clean #completed-tasks,body.studio-clean #settings-panel,body.studio-clean #settings-backdrop,body.studio-clean #projects-panel,body.studio-clean #projects-tab-wrapper,body.studio-clean #lesson-panel,body.studio-clean #working-indicator,body.studio-clean #selam-toast-stack,body.studio-clean #text-input,body.studio-clean #speak-btn,body.studio-clean #composer,body.studio-clean #input-row,body.studio-clean #input-wrap,body.studio-clean #mute-btn,body.studio-clean #start-btn{display:none !important}body.studio-clean #avatar-container{border-radius:0 !important}body.studio-clean{background:#05060c !important}";

const OVERLAY = `
#ad-brand{position:fixed;top:40px;left:48px;z-index:60;display:flex;align-items:center;gap:14px;font-family:-apple-system,system-ui,sans-serif}
#ad-brand .wm{font:700 28px/1 -apple-system,system-ui,sans-serif;letter-spacing:.14em;color:#f2f4fb;text-shadow:0 2px 12px rgba(0,0,0,.6)}
#ad-cap{position:fixed;left:50%;bottom:9%;transform:translateX(-50%);z-index:60;max-width:76%;text-align:center;
  font:800 46px/1.18 -apple-system,system-ui,sans-serif;color:#fff;white-space:pre-line;letter-spacing:-.01em;
  text-shadow:0 3px 22px rgba(0,0,0,.85),0 1px 3px rgba(0,0,0,.9);transition:opacity .25s}
#ad-end{position:fixed;inset:0;z-index:70;display:none;flex-direction:column;align-items:center;justify-content:center;gap:22px;
  background:radial-gradient(900px 640px at 50% 34%,#1b2344,#0c1024 46%,#05060c);font-family:-apple-system,system-ui,sans-serif}
#ad-end .wm{font:700 60px/1 -apple-system,system-ui,sans-serif;letter-spacing:.14em;color:#f2f4fb}
#ad-end .hl{font:800 52px/1.1 -apple-system,system-ui,sans-serif;color:#7be3a4;letter-spacing:-.01em}
#ad-end .url{font:600 36px/1 -apple-system,system-ui,sans-serif;color:#b6bbd2}
#ad-end .pill{margin-top:8px;background:linear-gradient(135deg,#8aa4ea,#617ECC);color:#07091a;font:800 30px/1 -apple-system,system-ui,sans-serif;padding:20px 40px;border-radius:999px}
`;

const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
let pg = null;
for (const c of b.contexts()) for (const p of c.pages()) { if (p.url().startsWith("devtools://")) continue; try { if (await p.evaluate(() => !!document.getElementById("text-input"))) { pg = p; break; } } catch (_) {} }
if (!pg) { console.log("NO_APP_PAGE"); process.exit(2); }

// session on
if (!(await pg.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive())))) {
  await pg.evaluate(() => { const s = document.getElementById("start-btn"); if (s) s.click(); });
  for (let i = 0; i < 25; i++) { await sleep(700); if (await pg.evaluate(() => !!(window.__selamSessionActive && window.__selamSessionActive()))) break; }
  await sleep(1500);
}
try { await pg.evaluate(() => { const m = document.getElementById("mute-btn"); if (m && document.body.classList.contains("mic-listening")) m.click(); }); } catch (_) {}
const hasRec = await pg.evaluate(() => !!(window.__selamRecorder && window.__selamRecorder.start));
const hasAd = await pg.evaluate(() => !!(window.__selamAdapter && window.__selamAdapter.speak));
console.log("recorder:", hasRec, "adapter:", hasAd);
if (!hasRec || !hasAd) { console.log("MISSING_GLOBALS"); process.exit(3); }

// clean chrome + overlays, center avatar
await pg.evaluate(({ clean, ov }) => {
  if (!document.getElementById("ad-clean")) { const s = document.createElement("style"); s.id = "ad-clean"; s.textContent = clean; document.head.appendChild(s); }
  if (!document.getElementById("ad-ov")) { const s = document.createElement("style"); s.id = "ad-ov"; s.textContent = ov; document.head.appendChild(s); }
  document.body.classList.add("studio-clean");
  const ac = document.getElementById("avatar-container"); if (ac) ac.style.transform = "";
  const mk = (id, html) => { let e = document.getElementById(id); if (!e) { e = document.createElement("div"); e.id = id; document.body.appendChild(e); } e.innerHTML = html; return e; };
  mk("ad-brand", '<span class="wm">SELAM</span>');
  const cap = mk("ad-cap", ""); cap.style.opacity = "0";
  mk("ad-end", '<div class="wm">SELAM</div><div class="hl">Runs ops while you sleep.</div><div class="url">heyselam.ai</div><div class="pill">Start free</div>');
}, { clean: CLEAN, ov: OVERLAY });
await sleep(1200);

// Appearance correction — the live avatar loads cold/blue (ambient tint +
// blue skin material). Restore the brand look: warm skin, dark hair, navy top.
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
await sleep(700);

const capState = () => pg.evaluate(() => { const a = window.__selamAdapter, av = a && a.avatar; return { f: av ? (av.speakingFactor || 0) : 0, q: (a && a._speakQueue && a._speakQueue.length) || 0, spk: !!(a && a.speaking) }; });
async function waitDone() {
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) { const s = await capState(); if (s.f > 0.06 || s.q > 0 || s.spk) break; await sleep(150); }
  let quiet = 0;
  while (Date.now() - t0 < 30000) { const s = await capState(); if (s.f < 0.06 && s.q === 0 && !s.spk) { if (++quiet >= 7) break; } else quiet = 0; await sleep(110); }
}

const rec = await pg.evaluate(() => window.__selamRecorder.start({ scope: "window" }));
console.log("REC:", JSON.stringify(rec));
await sleep(1200);
for (let i = 0; i < LINES.length; i++) {
  await pg.evaluate((t) => { const c = document.getElementById("ad-cap"); if (c) { c.textContent = t; c.style.opacity = "1"; } }, CAPTIONS[i]);
  await pg.evaluate((t) => { try { window.__selamAdapter.speak(t); } catch (_) {} }, LINES[i]);
  await waitDone();
  await sleep(260);
  await pg.evaluate(() => { const c = document.getElementById("ad-cap"); if (c) c.style.opacity = "0"; });
  await sleep(180);
}
// end card hold
await pg.evaluate(() => { const e = document.getElementById("ad-end"); if (e) e.style.display = "flex"; });
await sleep(2200);
const out = await pg.evaluate(() => window.__selamRecorder.stop());
await pg.evaluate(() => { ["ad-brand","ad-cap","ad-end"].forEach((id) => { const e = document.getElementById(id); if (e) e.remove(); }); document.body.classList.remove("studio-clean"); });
console.log("SAVED:", JSON.stringify(out));
await b.close();
