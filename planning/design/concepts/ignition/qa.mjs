// Ignition concept QA: console errors, horizontal overflow at 1440 and 390 px across the whole scroll, and the stills.
// Usage: node qa.mjs [--stills]   (needs a local Chrome or Edge; WebGL runs on SwiftShader in headless mode)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = fileURLToPath(new URL('./', import.meta.url));
const url = pathToFileURL(join(here, 'index.html')).href;
const STILLS = process.argv.includes('--stills');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const profile = mkdtempSync(join(tmpdir(), 'cx-ign-'));
const port = 9700 + Math.floor(Math.random() * 200);
const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run',
  '--disable-extensions', '--hide-scrollbars', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(200); } }
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  else if (m.method) events.push(m);
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable');
const log = (...a) => process.env.QA_DEBUG && console.log('·', ...a);
const js = async (expr) => (await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

async function load(width, height, media = []) {
  events.length = 0;
  await S('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await S('Emulation.setEmulatedMedia', { features: media });
  log('navigate', width); await S('Page.navigate', { url }); log('navigated');
  for (let i = 0; i < 100 && !events.some((e) => e.method === 'Page.loadEventFired'); i++) await sleep(100);
  log('loaded'); log('ping', await js('1+1')); await js('Promise.race([document.fonts.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 4000))])'); log('fonts', await js('[...document.fonts].filter(f => f.status === "loaded").length'));
}
const problems = () => events.filter((e) =>
  e.method === 'Runtime.exceptionThrown' ||
  (e.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(e.params.type)) ||
  (e.method === 'Log.entryAdded' && ['error', 'warning'].includes(e.params.entry.level)))
  .map((e) => e.params.exceptionDetails?.exception?.description || e.params.exceptionDetails?.text || e.params.args?.map((a) => a.value).join(' ') || e.params.entry?.text);
const shot = async (file) => {
  const { data } = await S('Page.captureScreenshot', { format: 'png' });
  mkdirSync(join(here, 'stills'), { recursive: true });
  writeFileSync(join(here, 'stills', file), Buffer.from(data, 'base64'));
  console.log('  still', file);
};
const scrollTo = async (sel, frac) => js(`(() => { const el = document.querySelector('${sel}'); const top = el.getBoundingClientRect().top + scrollY; window.scrollTo(0, top + (el.offsetHeight - innerHeight) * ${frac}); return true; })()`);

const report = {};
for (const [w, h] of [[1440, 900], [390, 844]]) {
  await load(w, h);
  await sleep(5200);
  const gl = await js('!document.body.classList.contains("nogl")');
  const over = [];
  const total = await js('document.documentElement.scrollHeight');
  for (let y = 0; y <= total; y += Math.round(h * .5)) {
    await js(`window.scrollTo(0, ${y}); true`); await sleep(90);
    const r = await js(`({ sw: document.documentElement.scrollWidth, iw: innerWidth, bw: document.body.scrollWidth })`);
    if (r.sw > r.iw || r.bw > r.iw) over.push({ y, ...r });
  }
  // the widest offenders, if any
  const wide = await js(`[...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && !e.closest('.rail,.ticker,#intro,.cur'); }).slice(0, 8).map(e => e.tagName + '.' + (typeof e.className === 'string' ? e.className : e.className.baseVal))`);
  report[w] = { webgl: gl, overflow: over, outside: wide, console: problems() };
  console.log(w, JSON.stringify(report[w]));
}
// reduced motion: still frame, no errors
await load(1440, 900, [{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await sleep(800);
report.reduced = { console: problems(), pre: await js('document.body.className') };
console.log('reduced', JSON.stringify(report.reduced));

if (STILLS) {
  await load(1440, 900);
  await js('__ign.hold(); __ign.seek(0.82); true'); await sleep(400); await shot('01-intro-glyph-lock.png');
  await js('__ign.seek(2.55); true'); await sleep(400); await shot('02-intro-ignition.png');
  await js('__ign.release(); true'); await sleep(2600); await shot('03-hero-settled.png');
  await scrollTo('#how', .3); await sleep(900); await shot('04-how-telemetry.png');
  await scrollTo('#product', .66); await sleep(900); await shot('05-product-quote.png');
  await scrollTo('#business', 0); await js('window.scrollBy(0, 200); true'); await sleep(1200); await shot('06-business-r0.png');
  await load(390, 844);
  await sleep(5200); await js('__ign.hold(); true'); await shot('07-mobile-hero.png');
  await scrollTo('#how', .62); await sleep(900); await shot('08-mobile-how.png');
  await scrollTo('#product', 1); await sleep(900); await shot('09-mobile-dashboard.png');
}
ws.close(); proc.kill(); await sleep(400);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
