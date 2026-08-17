// CDP screencast recorder for the Selam dev instance (:9222).
// usage: node cast.mjs <outdir> <seconds>
// Writes frame-%06d.jpg + times.txt (timestamp per frame) into outdir.
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = process.argv[2];
const SECONDS = Number(process.argv[3] || 10);
mkdirSync(OUT, { recursive: true });

const targets = await (await fetch("http://localhost:9222/json")).json();
const page = targets.find((t) => t.type === "page" && !t.url.startsWith("devtools://"));
if (!page) { console.error("no page target"); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const n = ++id;
  pending.set(n, { res, rej });
  ws.send(JSON.stringify({ id: n, method, params }));
});

let count = 0;
const times = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    return;
  }
  if (m.method === "Page.screencastFrame") {
    const { data, sessionId, metadata } = m.params;
    count += 1;
    writeFileSync(`${OUT}/frame-${String(count).padStart(6, "0")}.jpg`, Buffer.from(data, "base64"));
    times.push(metadata.timestamp);
    send("Page.screencastFrameAck", { sessionId });
  }
};

await send("Page.enable");
await send("Page.startScreencast", {
  format: "jpeg", quality: 85, everyNthFrame: 1,
});

await new Promise((r) => setTimeout(r, SECONDS * 1000));
await send("Page.stopScreencast");
writeFileSync(`${OUT}/times.txt`, times.join("\n"));
console.log(`captured ${count} frames over ${SECONDS}s → ${OUT}`);
process.exit(0);
