// api/tts.js — speaks an "Ask Selam" answer aloud (OpenAI nova → mp3), so the
// landing avatar can lip-sync it. Server-side key only. Text is capped so this
// can't be abused as a general TTS service.

import { rateLimited, budgetStatus, record, ttsCostUSD } from "./_svc.js";

const OPENAI_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  if (!OPENAI_KEY) { res.status(500).json({ error: "not configured" }); return; }

  const ip = ((req.headers["x-forwarded-for"] || "").split(",")[0] || "").trim() || "anon";
  if (await rateLimited("tts", ip, 20, 600)) { res.status(429).json({ error: "slow down" }); return; }
  // Over budget → skip voice (the text answer already showed); client falls back gracefully.
  if ((await budgetStatus()).over) { res.status(402).json({ error: "budget" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const text = (body && body.text ? String(body.text) : "").slice(0, 900).trim();
  if (!text) { res.status(400).json({ error: "empty" }); return; }

  let r;
  try {
    r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: "Bearer " + OPENAI_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts", input: text, voice: "nova", response_format: "mp3",
        instructions: "You are Selam — a warm, bright, confident AI companion. Speak naturally and friendly, a little playful, like you're genuinely glad to help.",
      }),
    });
  } catch (e) { res.status(502).json({ error: "tts unreachable" }); return; }

  if (!r.ok) { const t = await r.text().catch(() => ""); res.status(502).json({ error: "tts error", detail: t.slice(0, 200) }); return; }

  const buf = Buffer.from(await r.arrayBuffer());
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(buf);

  record("tts", { usd: ttsCostUSD(text.length), chars: text.length });   // best-effort
}
