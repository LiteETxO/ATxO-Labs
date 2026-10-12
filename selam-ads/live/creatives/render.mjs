import pkg from "/opt/homebrew/lib/node_modules/openclaw/dist/extensions/diffs/node_modules/playwright-core/index.js";
const { chromium } = pkg;
const dir = "/Users/michaelderibe/selam-ads/live/creatives";
const JOBS = [
  { f: "1x1-watch-live", w: 1080, h: 1080 },
  { f: "9x16-watch-live", w: 1080, h: 1920 },
];
const b = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
for (const j of JOBS) {
  const pg = await b.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 1 });
  await pg.goto(`file://${dir}/${j.f}.html`, { waitUntil: "networkidle" });
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: `${dir}/${j.f}.png` });
  console.log("rendered", j.f + ".png");
  await pg.close();
}
await b.close();
