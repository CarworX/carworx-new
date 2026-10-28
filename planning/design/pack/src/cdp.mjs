// Minimal DevTools-protocol driver for a local headless Chrome or Edge. Used by export.mjs and qa.mjs.
import { spawn } from 'node:child_process';
import { existsSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openBrowser() {
  const exe = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(existsSync);
  if (!exe) throw new Error('No Chrome or Edge found');
  const profile = mkdtempSync(join(tmpdir(), 'cx-pack-'));
  const port = 9300 + Math.floor(Math.random() * 400);
  const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--disable-extensions', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

  let wsUrl;
  for (let i = 0; i < 50 && !wsUrl; i++) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(200); }
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map(); const waiters = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    else if (m.method) for (const w of waiters) if (w.method === m.method) { waiters.splice(waiters.indexOf(w), 1); w.res(m.params); break; }
  });
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const once = (method) => new Promise((res) => waiters.push({ method, res }));

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  await S('Page.enable');
  const evalJs = async (expr) => (await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

  async function load(url, width, scale = 1, media = []) {
    await S('Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 800 : 900, deviceScaleFactor: scale, mobile: width < 768 });
    await S('Emulation.setEmulatedMedia', { features: media });
    // Go through about:blank so a URL that differs only by its hash still triggers a full load.
    const blank = once('Page.loadEventFired');
    await S('Page.navigate', { url: 'about:blank' });
    await blank;
    const loaded = once('Page.loadEventFired');
    await S('Page.navigate', { url });
    await loaded;
    await evalJs('document.fonts.ready.then(() => true)');
  }

  async function close() {
    ws.close(); proc.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }

  return { S, evalJs, load, close };
}
