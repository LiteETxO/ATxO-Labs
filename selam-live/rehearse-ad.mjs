// rehearse-ad.mjs — run a local rehearsal of the live show (no stream, nothing
// published) and record it for ad/promo B-roll. Drips a few realistic viewer
// comments so we capture her answering, bantering, and roasting a troll.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
const ROOT = "/Users/michaelderibe/selam-live";
const MOCK = path.join(ROOT, "mock-comments.txt");
fs.writeFileSync(MOCK, "");           // start empty; drip over the run

const drips = [
  [25,  "Marcus|wait — this is an actual AI hosting a LIVE show?? that's wild"],
  [70,  "Dana|can you really run my email and calendar for me?"],
  [110, "t0aster_boy|boooring 🥱 my microwave has more personality"],
  [150, "Priya|ok lol this is actually kind of amazing"],
  [175, "Kenji|puedes hablar español? 🙌"],
];
for (const [t, line] of drips) {
  setTimeout(() => { try { fs.appendFileSync(MOCK, line + "\n"); console.log(`💬 dripped @${t}s: ${line}`); } catch (_) {} }, t * 1000);
}

const env = { ...process.env, SELAM_REHEARSE: "1", SELAM_CHAT_PLATFORM: "mock", SELAM_LIVE_MINUTES: "3" };
const child = spawn("node", ["host-loop.mjs"], { cwd: ROOT, env, stdio: "inherit" });
child.on("exit", (code) => { console.log("host-loop exited", code); process.exit(code || 0); });
