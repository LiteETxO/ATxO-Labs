// post-video.mjs — upload a local video to YouTube and/or TikTok.
//
//   node post-video.mjs youtube <file> --title "..." [--desc "..."] [--tags a,b] [--privacy private|unlisted|public]
//   node post-video.mjs tiktok  <file> --caption "..." [--publish]     (omit --publish → lands as a private draft)
//
// YouTube: our own OAuth (SELAM_YT_CLIENT_ID/SECRET/REFRESH_TOKEN in .env) →
//   resumable upload to the YouTube Data API. Reliable for local files.
// TikTok: Composio's TIKTOK_UPLOAD_VIDEO (file_uploadable) via the presigned
//   upload flow. Needs a TikTok account connected in Composio. Direct public
//   posting requires TikTok to have audited the app; until then --publish still
//   lands as SELF_ONLY (a private draft) in the user's TikTok inbox.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
for (const l of (() => { try { return fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/); } catch (_) { return []; } })()) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── args ────────────────────────────────────────────────────────────────
const [, , platform, file, ...rest] = process.argv;
if (!platform || !file) { console.error("usage: node post-video.mjs <youtube|tiktok> <file> [--title ..] [--caption ..] [--desc ..] [--tags a,b] [--privacy private] [--publish]"); process.exit(1); }
const opts = {};
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === "--publish") opts.publish = true;
  else if (a.startsWith("--")) { opts[a.slice(2)] = rest[i + 1]; i++; }
}
if (!fs.existsSync(file)) { console.error("✗ file not found:", file); process.exit(1); }
const mimeOf = (f) => (f.endsWith(".webm") ? "video/webm" : f.endsWith(".mov") ? "video/quicktime" : "video/mp4");

function composioKey() {
  try { const f = fs.readFileSync(path.join(process.env.HOME, ".openclaw/secrets/composio_api_key"), "utf8").trim(); if (f) return f; } catch (_) {}
  try { return execSync("security find-generic-password -s selam.byok -a composio_api_key -w", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch (_) {}
  return "";
}
function md5(p) { const h = crypto.createHash("md5"); h.update(fs.readFileSync(p)); return h.digest("hex"); }

// ── YouTube ───────────────────────────────────────────────────────────────
async function ytAccessToken() {
  const { SELAM_YT_CLIENT_ID: cid, SELAM_YT_CLIENT_SECRET: sec, SELAM_YT_REFRESH_TOKEN: rt } = process.env;
  if (!cid || !sec || !rt) throw new Error("YouTube not authorized — run: node youtube-auth.mjs (needs SELAM_YT_CLIENT_ID/SECRET/REFRESH_TOKEN)");
  const body = new URLSearchParams({ client_id: cid, client_secret: sec, refresh_token: rt, grant_type: "refresh_token" });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
  const j = await r.json();
  if (!j.access_token) throw new Error("token refresh failed: " + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}
async function uploadYouTube() {
  const token = await ytAccessToken();
  const privacy = (opts.privacy || "private").toLowerCase();
  const meta = {
    snippet: { title: opts.title || "Selam clip", description: opts.desc || "", tags: (opts.tags || "").split(",").map((s) => s.trim()).filter(Boolean), categoryId: opts.categoryId || "22" },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
  };
  const mt = mimeOf(file), size = fs.statSync(file).size;
  console.log(`① YouTube resumable init (${privacy}) …`);
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mt, "X-Upload-Content-Length": String(size) },
    body: JSON.stringify(meta),
  });
  if (!init.ok) throw new Error("init failed " + init.status + ": " + (await init.text()).slice(0, 300));
  const session = init.headers.get("location");
  if (!session) throw new Error("no resumable session URL");
  console.log(`② uploading ${(size / 1e6).toFixed(1)} MB in chunks …`);
  const j = await resumableUpload(session, file, size);
  if (!j || !j.id) throw new Error("upload failed: " + JSON.stringify(j).slice(0, 300));
  console.log(`✅ YouTube upload OK → https://youtu.be/${j.id}  (${(j.status || {}).privacyStatus})`);
  return j.id;
}

// Chunked resumable upload — survives a dropped connection on large files by
// retrying each chunk and resyncing the offset from the server (a single PUT of
// the whole file "fetch failed" on a 154 MB clip).
async function ytQueryOffset(session, size) {
  const r = await fetch(session, { method: "PUT", headers: { "Content-Range": `bytes */${size}` }, redirect: "manual" });
  if (r.status === 200 || r.status === 201) return { done: true, json: await r.json() };
  const range = r.headers.get("range");
  let off = 0;
  if (range) { const m = range.match(/-(\d+)\s*$/); if (m) off = parseInt(m[1], 10) + 1; }
  return { done: false, offset: off };
}
async function resumableUpload(session, file, size) {
  const CHUNK = 8 * 1024 * 1024;   // 8 MB chunks
  const fd = fs.openSync(file, "r");
  try {
    let offset = 0;
    while (offset < size) {
      const end = Math.min(offset + CHUNK, size);
      const len = end - offset;
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, offset);
      let advanced = false;
      for (let attempt = 1; attempt <= 6; attempt++) {
        try {
          const resp = await fetch(session, {
            method: "PUT",
            headers: { "Content-Length": String(len), "Content-Range": `bytes ${offset}-${end - 1}/${size}` },
            body: buf, redirect: "manual",
          });
          if (resp.status === 200 || resp.status === 201) return await resp.json();   // final chunk → done
          if (resp.status === 308) {                                                  // incomplete → next chunk
            const range = resp.headers.get("range");
            offset = range && range.match(/-(\d+)\s*$/) ? parseInt(range.match(/-(\d+)\s*$/)[1], 10) + 1 : end;
            const pct = Math.min(100, Math.round((offset / size) * 100));
            process.stdout.write(`   … ${pct}%\r`);
            advanced = true; break;
          }
          throw new Error("unexpected status " + resp.status + ": " + (await resp.text()).slice(0, 150));
        } catch (e) {
          if (attempt >= 6) throw new Error(`chunk at ${offset} failed after retries: ${e.message}`);
          await sleep(1500 * attempt);
          try { const q = await ytQueryOffset(session, size); if (q.done) return q.json; offset = q.offset; advanced = true; } catch (_) {}
          break;   // recompute chunk from the (possibly resynced) offset
        }
      }
      if (!advanced) { /* offset unchanged → loop retries same chunk */ }
    }
    const q = await ytQueryOffset(session, size);   // reached end via 308s → fetch final resource
    if (q.done) return q.json;
    throw new Error("upload completed but no final response");
  } finally {
    fs.closeSync(fd);
  }
}

// ── TikTok (via Composio) ──────────────────────────────────────────────────
async function capi(method, path, body) {
  const CKEY = composioKey();
  if (!CKEY) throw new Error("no Composio API key");
  const r = await fetch("https://backend.composio.dev/api/v3" + path, {
    method, headers: { "x-api-key": CKEY, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch (_) { j = { raw: t }; }
  return { status: r.status, j };
}
async function tiktokConnected() {
  const { j } = await capi("GET", "/connected_accounts?limit=50");
  const a = (j.items || []).find((i) => ((i.toolkit || {}).slug === "tiktok") && i.status === "ACTIVE");
  return !!a;
}
async function uploadTikTok() {
  if (!(await tiktokConnected())) throw new Error("no ACTIVE TikTok account connected in Composio — connect TikTok in Settings first.");
  const mt = mimeOf(file), name = path.basename(file);
  console.log("① requesting TikTok presigned upload …");
  const { j: reqj, status } = await capi("POST", "/files/upload/request", { md5: md5(file), toolkit_slug: "tiktok", tool_slug: "TIKTOK_UPLOAD_VIDEO", filename: name, mimetype: mt });
  if (status !== 200) throw new Error("upload/request failed: " + JSON.stringify(reqj).slice(0, 200));
  const d = reqj.data || reqj;
  const url = d.new_presigned_url || d.url, key = d.key;
  if (url && !d.exists) {
    console.log(`② uploading ${(fs.statSync(file).size / 1e6).toFixed(1)} MB to Composio …`);
    const put = await fetch(url, { method: "PUT", headers: { "Content-Type": mt }, body: fs.readFileSync(file) });
    if (!put.ok && put.status !== 403) throw new Error("presigned PUT failed: " + put.status);
  }
  console.log(`③ TikTok ${opts.publish ? "publish" : "upload (draft)"} …`);
  const { j: exj } = await capi("POST", "/tools/execute/TIKTOK_UPLOAD_VIDEO", {
    user_id: "default",
    arguments: { file_to_upload: { name, mimetype: mt, s3key: key }, caption: opts.caption || opts.title || "", publish: !!opts.publish },
  });
  const ok = exj.successful;
  if (!ok) throw new Error("TikTok upload failed: " + (exj.error || JSON.stringify(exj)).slice(0, 300));
  console.log(`✅ TikTok ${opts.publish ? "publish attempted" : "uploaded as draft (open TikTok → inbox to post)"} —`, JSON.stringify(exj.data || {}).slice(0, 200));
  return true;
}

(async () => {
  const p = platform.toLowerCase();
  if (p === "youtube" || p === "yt") await uploadYouTube();
  else if (p === "tiktok" || p === "tt") await uploadTikTok();
  else { console.error("✗ unknown platform:", platform); process.exit(1); }
})().catch((e) => { console.error("✗ post-video failed:", e.message); process.exit(1); });
