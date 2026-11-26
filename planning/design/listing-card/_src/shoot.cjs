// node shoot.cjs <gallery.html> <out-dir> [review]
// review: one full-page 1x shot. Otherwise: each board at real size, 2x.
const { chromium } = require("playwright");
(async () => {
  const [, , html, outDir, mode] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: mode === "review" ? 1 : 2,
  });
  await p.goto("file://" + html);
  await p.waitForTimeout(400);
  if (mode === "review") {
    await p.screenshot({ path: `${outDir}/full.png`, fullPage: true });
  } else {
    await p.evaluate(() => document.body.classList.add("export"));
    await p.waitForTimeout(200);
    for (const el of await p.$$("[data-shot]")) {
      const n = await el.getAttribute("data-shot");
      await el.screenshot({ path: `${outDir}/${n}.png` });
      console.log(n);
    }
  }
  await b.close();
})();
