// ads-auth.mjs — one-time Google Ads API OAuth to mint a durable refresh token,
// so scripts can manage campaigns on your account without a browser each run.
//
// PREREQS (done in the browser first — see the walkthrough):
//   1. A Google Ads MANAGER (MCC) account + an approved developer token.
//   2. A Google Cloud project with "Google Ads API" enabled.
//   3. An OAuth client of type "Desktop app" → copy its ID + secret into
//      ~/selam-live/.env as:
//        GOOGLE_ADS_CLIENT_ID=...
//        GOOGLE_ADS_CLIENT_SECRET=...
//   4. On the OAuth consent screen add YOUR Google account as a Test user.
//
// RUN:  node ads-auth.mjs   → opens the consent screen; approve with the Google
//       account that owns the Ads manager. The refresh token is written to .env
//       as GOOGLE_ADS_REFRESH_TOKEN.
//
import fs from "fs";
import path from "path";
import http from "http";
import crypto from "crypto";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ENV = path.join(ROOT, ".env");
// Full Google Ads API access (read + manage campaigns, budgets, audiences, ads).
const SCOPE = "https://www.googleapis.com/auth/adwords";

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
const CID = env.GOOGLE_ADS_CLIENT_ID, SECRET = env.GOOGLE_ADS_CLIENT_SECRET;
if (!CID || !SECRET) {
  console.error("✗ Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET in ~/selam-live/.env first (see the header).");
  process.exit(1);
}

let REDIRECT = "";
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://127.0.0.1");
    if (!u.pathname.startsWith("/cb")) { res.writeHead(404); res.end(); return; }
    const code = u.searchParams.get("code");
    const err = u.searchParams.get("error");
    if (err) { res.writeHead(200, { "Content-Type": "text/html" }); res.end(`<h2>Auth failed: ${err}</h2>`); server.close(); process.exit(1); }
    const body = new URLSearchParams({
      code, client_id: CID, client_secret: SECRET,
      redirect_uri: REDIRECT, grant_type: "authorization_code",
    });
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body });
    const j = await r.json();
    if (!j.refresh_token) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<h2>No refresh token returned.</h2><p>Revoke the app at myaccount.google.com/permissions and run again (needs prompt=consent).</p><pre>${JSON.stringify(j).slice(0, 400)}</pre>`);
      console.error("✗ no refresh_token:", JSON.stringify(j).slice(0, 300));
      server.close(); process.exit(1);
    }
    setEnv("GOOGLE_ADS_REFRESH_TOKEN", j.refresh_token);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h2>✅ Google Ads API is now authorized.</h2><p>Refresh token saved. You can close this tab.</p>");
    console.log("✅ refresh token saved to ~/selam-live/.env (GOOGLE_ADS_REFRESH_TOKEN)");
    server.close(); setTimeout(() => process.exit(0), 300);
  } catch (e) { console.error("callback error:", e.message); try { res.writeHead(500); res.end(); } catch (_) {} server.close(); process.exit(1); }
});

server.listen(0, "127.0.0.1", () => {
  const port = server.address().port;
  REDIRECT = `http://127.0.0.1:${port}/cb`;
  const auth = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: CID, redirect_uri: REDIRECT, response_type: "code",
    scope: SCOPE, access_type: "offline", prompt: "consent",
    state: crypto.randomBytes(8).toString("hex"),
  });
  console.log("Opening the Google consent screen…\nIf it doesn't open, visit:\n" + auth + "\n");
  try { execSync(`open ${JSON.stringify(auth)}`); } catch (_) {}
});
