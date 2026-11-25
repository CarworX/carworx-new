// Screenshots every built screen at 1280 and 390 wide, deviceScaleFactor 2,
// full page. Run from the repo root: node planning/design/redesign-2026-11/_src/shoot.cjs [filter]
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(4817, r));
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "manifest.json"), "utf8"));
  const filter = process.argv[2] || "";
  const browser = await chromium.launch();
  for (const m of manifest.filter((m) => m.file.includes(filter))) {
    for (const w of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width: w, height: w === 390 ? 844 : 900 }, deviceScaleFactor: 2 });
      await page.goto(`http://localhost:4817/${m.file}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      const out = path.join(ROOT, path.dirname(m.file), "png", path.basename(m.file, ".html") + `-${w}.png`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await page.screenshot({ path: out, fullPage: true, animations: "disabled" });
      await page.close();
    }
    console.log("shot", m.file);
  }
  await browser.close();
  server.close();
})();
