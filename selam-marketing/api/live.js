// api/live.js — Is Selam live-streaming right now? Lets the landing page pop a
// "🔴 LIVE" watch window whenever she's hosting on Facebook (and/or YouTube).
//
// Checks the Facebook Page's live_videos and, if configured, a YouTube channel.
// All tokens stay server-side. The upstream result is cached in-process (~30s)
// so heavy visitor polling never hammers the Graph / YouTube APIs or burns quota.
//
// Env (all optional — missing config just reports offline, never errors):
//   SELAM_FB_PAGE_ID, SELAM_FB_TOKEN   Page id + permanent Page token
//   FB_APP_SECRET                      to sign calls with appsecret_proof
//   SELAM_FB_NOPROOF=1                 skip appsecret_proof (if app has it off)
//   YOUTUBE_CHANNEL_ID, YOUTUBE_API_KEY  optional YouTube Live detection

import crypto from "node:crypto";

const FB_PAGE_ID = process.env.SELAM_FB_PAGE_ID || "";
const FB_TOKEN   = process.env.SELAM_FB_TOKEN || "";
const FB_SECRET  = process.env.FB_APP_SECRET || "";
const FB_NOPROOF = process.env.SELAM_FB_NOPROOF === "1";
const YT_CHANNEL = process.env.YOUTUBE_CHANNEL_ID || "";
const YT_KEY     = process.env.YOUTUBE_API_KEY || "";

const GRAPH  = "https://graph.facebook.com/v21.0";
const TTL_MS = 30_000;

// Warm-instance cache so N concurrent visitors cost at most one upstream call
// per TTL window.
let cache = { ts: 0, data: null };

function proof(token) {
  if (FB_NOPROOF || !FB_SECRET) return "";
  return crypto.createHmac("sha256", FB_SECRET).update(token).digest("hex");
}

async function checkFacebook() {
  if (!FB_PAGE_ID || !FB_TOKEN) return null;
  const p = proof(FB_TOKEN);
  const url = `${GRAPH}/${FB_PAGE_ID}/live_videos`
    + `?fields=id,status,permalink_url,title`
    + `&limit=5&access_token=${encodeURIComponent(FB_TOKEN)}`
    + (p ? `&appsecret_proof=${p}` : "");
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  const items = Array.isArray(j.data) ? j.data : [];
  const one = items.find(v => v.status === "LIVE" || v.status === "LIVE_NOW");
  if (!one) return null;
  const href = one.permalink_url
    ? (one.permalink_url.startsWith("http")
        ? one.permalink_url
        : `https://www.facebook.com${one.permalink_url}`)
    : `https://www.facebook.com/${FB_PAGE_ID}/videos/${one.id}`;
  const embedUrl = "https://www.facebook.com/plugins/video.php?href="
    + encodeURIComponent(href)
    + "&show_text=false&autoplay=true&mute=true&width=560";
  return {
    live: true,
    platform: "facebook",
    id: String(one.id),
    title: one.title || "Selam is live",
    watchUrl: href,
    embedUrl,
  };
}

async function checkYouTube() {
  if (!YT_CHANNEL || !YT_KEY) return null;
  const url = "https://www.googleapis.com/youtube/v3/search"
    + `?part=snippet&channelId=${encodeURIComponent(YT_CHANNEL)}`
    + `&eventType=live&type=video&maxResults=1&key=${encodeURIComponent(YT_KEY)}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  const it = (j.items || [])[0];
  if (!it || !it.id || !it.id.videoId) return null;
  const vid = it.id.videoId;
  return {
    live: true,
    platform: "youtube",
    id: vid,
    title: (it.snippet && it.snippet.title) || "Selam is live",
    watchUrl: `https://www.youtube.com/watch?v=${vid}`,
    embedUrl: `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&playsinline=1`,
  };
}

async function probe() {
  // Facebook is the active platform today; YouTube is a ready fallback.
  const [fbR, ytR] = await Promise.allSettled([checkFacebook(), checkYouTube()]);
  const fb = fbR.status === "fulfilled" ? fbR.value : null;
  const yt = ytR.status === "fulfilled" ? ytR.value : null;
  const primary = fb || yt;
  if (!primary) return { live: false };
  // If she happens to be on both, expose the other so the client can link it.
  const other = fb && yt ? (primary === fb ? yt : fb) : null;
  return other
    ? { ...primary, also: { platform: other.platform, watchUrl: other.watchUrl } }
    : primary;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=20, s-maxage=20");
  try {
    const now = Date.now();
    if (!cache.data || now - cache.ts > TTL_MS) {
      cache = { ts: now, data: await probe() };
    }
    res.status(200).json(cache.data);
  } catch {
    res.status(200).json({ live: false });
  }
}
