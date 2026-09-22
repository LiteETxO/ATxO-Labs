// supervisor.mjs — keeps Selam live on Facebook, unattended.
//
// Adopts the current healthy broadcast if there is one; otherwise takes her
// live. Then polls FB ingest health every 30s and, on a confirmed drop
// (status != LIVE or video_bitrate == 0 for 2 checks in a row), automatically
// re-goes-live: kills the stale pusher, runs take-live.mjs (which creates a
// fresh broadcast, starts the app stream, waits for real data, then publishes),
// and restarts the host-loop against the new video. Runs forever until killed.
import { spawn, execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/michaelderibe/selam-live";
const ENVP = path.join(ROOT, ".env");
const LOGP = path.join(ROOT, "supervisor.log");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(ENVP, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2];
    }
  } catch (_) {}
  return env;
}
function log(msg) {
  const line = `[${new Date().toTimeString().slice(0, 8)}] ${msg}\n`;
  try { fs.appendFileSync(LOGP, line); } catch (_) {}
  process.stdout.write(line);
}
function proof(token, secret) {
  return secret ? crypto.createHmac("sha256", secret).update(token).digest("hex") : "";
}
async function health(video) {
  const e = readEnv(), T = e.SELAM_FB_TOKEN, S = e.FB_APP_SECRET, p = proof(T, S);
  try {
    const url = `https://graph.facebook.com/v21.0/${video}`
      + `?fields=status,live_views,ingest_streams{stream_health}`
      + `&access_token=${encodeURIComponent(T)}${p ? `&appsecret_proof=${p}` : ""}`;
    const j = await (await fetch(url)).json();
    if (j.error) return { status: "ERR", vb: 0, err: j.error.message };
    const h = j.ingest_streams && j.ingest_streams[0] && j.ingest_streams[0].stream_health;
    return { status: j.status, vb: h ? (h.video_bitrate || 0) : 0, views: j.live_views || 0 };
  } catch (e) { return { status: "ERR", vb: 0, err: e.message }; }
}
function killFfmpeg() { try { spawn("pkill", ["-f", "rtmps://live-api-s.facebook.com"]); } catch (_) {} }

async function startHostLoop() {
  try { spawn("pkill", ["-f", "host-loop.mjs"]); } catch (_) {}
  await sleep(1200);
  const out = fs.openSync(path.join(ROOT, "host-loop.log"), "a");
  const child = spawn("node", ["host-loop.mjs"], { cwd: ROOT, stdio: ["ignore", out, out] });
  log(`host-loop restarted (pid ${child.pid})`);
}
function goLive() {
  return new Promise((resolve) => {
    execFile("node", ["take-live.mjs"], { cwd: ROOT, maxBuffer: 10_000_000 }, (err, stdout, stderr) => {
      const m = (stdout || "").match(/VIDEO_ID=(\d+)/);
      resolve({ ok: !err && !!m, video: m && m[1], code: err && (err.code || err.signal), out: (stdout || "") + (stderr || "") });
    });
  });
}
async function ensureLive(reason) {
  log(`=== going live (${reason}) ===`);
  killFfmpeg();
  await sleep(1500);
  let attempt = 0;
  while (true) {
    attempt++;
    const r = await goLive();
    if (r.ok) { log(`✅ live on video ${r.video}`); await startHostLoop(); return r.video; }
    const backoff = Math.min(60000, 8000 * attempt);
    log(`go-live attempt ${attempt} failed (code ${r.code}); retry in ${backoff / 1000}s. tail:\n`
      + r.out.split("\n").slice(-6).join("\n"));
    await sleep(backoff);
  }
}

// ---- main ----
log("supervisor starting");
let video = readEnv().SELAM_FB_VIDEO || "";
let h = video ? await health(video) : { status: "NONE", vb: 0 };
if (video && h.status === "LIVE" && h.vb > 0) {
  log(`adopting healthy live broadcast ${video} (bitrate ${h.vb})`);
  await startHostLoop();          // take ownership of the content driver
} else {
  log(`no healthy broadcast (status=${h.status}, vb=${h.vb})`);
  video = await ensureLive("startup");
}

let bad = 0;
while (true) {
  await sleep(30000);
  video = readEnv().SELAM_FB_VIDEO || video;
  const s = await health(video);
  log(`status=${s.status} video_bitrate=${s.vb} views=${s.views || 0}${s.err ? " err=" + s.err : ""}`);
  if (s.status !== "LIVE" || !s.vb) {
    bad++;
    if (bad >= 2) { video = await ensureLive("drop-recovery"); bad = 0; }
  } else { bad = 0; }
}
