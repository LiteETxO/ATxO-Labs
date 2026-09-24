// youtube-auth.mjs — one-time YouTube OAuth to get a durable refresh token so
// Selam can upload videos (VOD) to your channel via the YouTube Data API.
//
// Why this (vs Composio): Composio's YOUTUBE_UPLOAD_VIDEO can't take a local
// file, and its access token can't be refreshed by us. Our own OAuth client
// gives us a refresh token we control → reliable resumable uploads.
//
// SETUP (once, in Google Cloud Console, on the Google account that OWNS the
// YouTube channel):
//   1. Create/select a project → enable "YouTube Data API v3".
//   2. OAuth consent screen: External, add yourself as a Test user.
//   3. Credentials → Create OAuth client ID → type "Desktop app".
//   4. Copy the Client ID + Client secret into ~/selam-live/.env as:
//        SELAM_YT_CLIENT_ID=...
//        SELAM_YT_CLIENT_SECRET=...
//   5. Run:  node youtube-auth.mjs
//      A browser opens; approve. The refresh token is written to .env as
//        SELAM_YT_REFRESH_TOKEN=...
//
import fs from "fs";
import path from "path";
import http from "http";
import crypto from "crypto";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ENV = path.join(ROOT, ".env");
const SCOPE = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

function readEnv() {
  const out = {};
  try {
    for (const l of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch (_) {}
  return out;
}
function setEnv(key, val) {
  let lines = [];
  try { lines = fs.readFileSync(ENV, "utf8").split(/\r?\n/); } catch (_) {}
  let found = false;
  lines = lines.map((l) => {
    if (l.match(new RegExp(`^\\s*${key}\\s*=`))) { found = true; return `${key}=${val}`; }
    return l;
  });
  if (!found) lines.push(`${key}=${val}`);
  fs.writeFileSync(ENV, lines.filter((l, i) => !(l === "" && i === lines.length - 1)).join("\n") + "\n");
}

const env = readEnv();
const CID = env.SELAM_YT_CLIENT_ID, SECRET = env.SELAM_YT_CLIENT_SECRET;
if (!CID || !SECRET) {
  console.error("✗ Set SELAM_YT_CLIENT_ID and SELAM_YT_CLIENT_SECRET in ~/selam-live/.env first (see the header of this file).");
  process.exit(1);
}

// Loopback OAuth (Desktop-app client): redirect to http://127.0.0.1:<port>.
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://127.0.0.1`);
    if (!u.pathname.startsWith("/cb")) { res.writeHead(404); res.end(); return; }
    const code = u.searchParams.get("code");
    const err = u.searchParams.get("error");
    if (err) { res.writeHead(200, { "Content-Type": "text/html" }); res.end(`<h2>Auth failed: ${err}</h2>`); server.close(); process.exit(1); }
    // Exchange the code for tokens.
    const body = new URLSearchParams({
      code, client_id: CID, client_secret: SECRET,
      redirect_uri: REDIRECT, grant_type: "authorization_code",
    });
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
    const j = await r.json();
    if (!j.refresh_token) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<h2>No refresh token returned.</h2><p>Revoke the app's access at myaccount.google.com/permissions and run again (needs prompt=consent).</p><pre>${JSON.stringify(j).slice(0, 400)}</pre>`);
      console.error("✗ no refresh_token:", JSON.stringify(j).slice(0, 300));
      server.close(); process.exit(1);
    }
    setEnv("SELAM_YT_REFRESH_TOKEN", j.refresh_token);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h2>✅ Selam is now authorized to upload to your YouTube channel.</h2><p>You can close this tab.</p>");
    console.log("✅ refresh token saved to ~/selam-live/.env (SELAM_YT_REFRESH_TOKEN)");
    server.close(); setTimeout(() => process.exit(0), 300);
  } catch (e) { console.error("callback error:", e.message); try { res.writeHead(500); res.end(); } catch (_) {} server.close(); process.exit(1); }
});

let REDIRECT = "";
server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  REDIRECT = `http://127.0.0.1:${port}/cb`;
  const auth = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: CID, redirect_uri: REDIRECT, response_type: "code",
    scope: SCOPE, access_type: "offline", prompt: "consent",
    state: crypto.randomBytes(8).toString("hex"),
  });
  console.log("Opening the Google consent screen in your browser…");
  console.log("If it doesn't open, visit:\n" + auth + "\n");
  try { execSync(`open ${JSON.stringify(auth)}`); } catch (_) {}
});
