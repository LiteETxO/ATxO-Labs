// take-live.mjs — take Selam live on the Facebook Page end-to-end:
//   create broadcast (UNPUBLISHED) -> start the app stream -> publish LIVE_NOW.
// The host-loop (content/comments driver) is started separately afterward.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
const { chromium } = pkg;

const ROOT = "/Users/michaelderibe/selam-live";
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const TOKEN = process.env.SELAM_FB_TOKEN, PAGE = process.env.SELAM_FB_PAGE_ID;
const SECRET = process.env.FB_APP_SECRET, NOPROOF = !!process.env.SELAM_FB_NOPROOF;
const GRAPH = "https://graph.facebook.com/v21.0";

function proof() { return (NOPROOF || !SECRET) ? "" : crypto.createHmac("sha256", SECRET).update(TOKEN).digest("hex"); }
async function graph(method, node, params = {}) {
  const body = new URLSearchParams(params);
  body.set("access_token", TOKEN);
  const p = proof(); if (p) body.set("appsecret_proof", p);
  const url = `${GRAPH}/${node}`;
  const r = method === "GET" ? await fetch(url + "?" + body.toString()) : await fetch(url, { method, body });
  const j = await r.json();
  if (j.error) throw new Error(`${node}: ${j.error.message}`);
  return j;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Create the broadcast (unpublished so we can warm the ingest first).
console.log("① creating broadcast on page", PAGE, "…");
const created = await graph("POST", `${PAGE}/live_videos`, {
  status: "UNPUBLISHED",
  title: "Selam — Live",
  description: "Meet Selam, an AI operator for your Mac. heyselam.ai",
});
const VIDEO = created.id, STREAM_URL = created.secure_stream_url;
if (!STREAM_URL) throw new Error("no secure_stream_url returned");
fs.writeFileSync(path.join(ROOT, ".live.json"), JSON.stringify({ id: VIDEO, secure_stream_url: STREAM_URL }, null, 2));
// Point .env at the new video so the host-loop attaches to THIS broadcast.
let env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
env = /^SELAM_FB_VIDEO=/m.test(env)
  ? env.replace(/^SELAM_FB_VIDEO=.*$/m, `SELAM_FB_VIDEO=${VIDEO}`)
  : env.trimEnd() + `\nSELAM_FB_VIDEO=${VIDEO}\n`;
fs.writeFileSync(path.join(ROOT, ".env"), env);
console.log("   broadcast id:", VIDEO);

// 2. Start the app stream via CDP.
console.log("② connecting to the app (CDP 9222) …");
const b = await chromium.connectOverCDP("http://127.0.0.1:9222");
let page = null;
for (const c of b.contexts()) {
  for (const p of c.pages()) {
    const has = await p.evaluate(() => !!(window.__selamLive && window.__selamLive.start)).catch(() => false);
    if (has) { page = p; break; }
  }
  if (page) break;
}
if (!page) { await b.close(); throw new Error("no app page exposing window.__selamLive"); }
await page.evaluate(async () => { try { await window.__selamLive.stop(); } catch (_) {} });
await sleep(1500);
// Simulcast: also push to YouTube when SELAM_YT_URL is set (main.js tees the
// single encode to both Facebook + YouTube). Set SELAM_NO_YT=1 to force
// Facebook-only (gives the whole uplink to one stream on a slow connection).
const YT = process.env.SELAM_NO_YT ? "" : (process.env.SELAM_YT_URL || "").trim();
// Simulcast doubles upload (same encode teed to BOTH FB + YouTube), so drop
// the per-stream bitrate to fit the uplink — 2000k x2 ≈ the single-stream budget.
// FB-only bitrate is tunable via SELAM_FB_BITRATE for slow uplinks.
const res = await page.evaluate(
  async ({ u, yt, br }) => await window.__selamLive.start(u, {
    music: true, overlay: true, youtube: yt || undefined,
    bitrate: yt ? "2000k" : br,
  }),
  { u: STREAM_URL, yt: YT, br: process.env.SELAM_FB_BITRATE || "4000k" });
console.log("   stream start:", JSON.stringify(res), YT ? "(+ YouTube @2000k x2)" : "(Facebook only)");
await b.close();
if (!res || !res.ok) throw new Error("stream start failed: " + (res && res.error));

// 3. Warm the ingest — publish ONLY once FB confirms real data is arriving
//    (video_bitrate > 0). Publishing before data flows is what makes FB end
//    the broadcast to VOD.
async function bitrate() {
  try {
    const j = await graph("GET", VIDEO, { fields: "ingest_streams{stream_health}" });
    const h = j.ingest_streams && j.ingest_streams[0] && j.ingest_streams[0].stream_health;
    return h ? { v: h.video_bitrate || 0, a: h.audio_bitrate || 0 } : { v: 0, a: 0 };
  } catch { return { v: 0, a: 0 }; }
}
console.log("③ waiting for ingest to carry real data …");
let healthy = false;
for (let i = 0; i < 20; i++) {   // up to ~60s
  await sleep(3000);
  const br = await bitrate();
  console.log(`   ingest check ${i + 1}: video=${br.v} audio=${br.a}`);
  if (br.v > 0) { healthy = true; break; }
}
if (!healthy) {
  console.log("⚠ ingest never showed bitrate > 0 — the app isn't delivering frames. Not publishing.");
  process.exit(2);
}
console.log("④ data confirmed — publishing LIVE_NOW …");
await graph("POST", VIDEO, { status: "LIVE_NOW" });
await sleep(5000);
const chk = await graph("GET", VIDEO, { fields: "status,permalink_url,ingest_streams{stream_health}" });
const br2 = chk.ingest_streams && chk.ingest_streams[0] && chk.ingest_streams[0].stream_health;
const permalink = chk.permalink_url && (chk.permalink_url.startsWith("http") ? chk.permalink_url : "https://www.facebook.com" + chk.permalink_url);
console.log("✅ status:", chk.status, "| video_bitrate:", br2 && br2.video_bitrate, "| watch:", permalink);
console.log("VIDEO_ID=" + VIDEO);
