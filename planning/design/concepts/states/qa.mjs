// States QA: console errors and horizontal overflow at 1440 and 390 px for every concept (motion and still),
// JS time per frame, and the stills (404s with a simulated pointer path).
// Usage: node qa.mjs check | stills | shot <hash> <w> <h> <file> [path]
// Add --approved to run against the approved page in planning/design/states/ (its stills and report go there).
// Needs a local Chrome or Edge. WebGL runs on SwiftShader in headless mode.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = fileURLToPath(new URL('./', import.meta.url));
const AP = process.argv.includes('--approved'), dir = AP ? join(here, '../../states') : here;
const base = pathToFileURL(join(dir, 'index.html')).href;
const [mode = 'check', ...args] = process.argv.slice(2).filter((a) => a !== '--approved');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lerp = (a, b, t) => a + (b - a) * t;
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const profile = mkdtempSync(join(tmpdir(), 'cx-states-'));
const port = 9300 + Math.floor(Math.random() * 400);
const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run',
  '--disable-extensions', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', 'about:blank'], { stdio: 'ignore' });
let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(200); } }
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
  else if (m.method) events.push(m);
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const i = ++id, t = setTimeout(() => { pending.delete(i); rej(new Error('timeout ' + method)); }, 30000);
  pending.set(i, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } });
  ws.send(JSON.stringify({ id: i, method, params, sessionId }));
});
let targetId, sessionId;
const S = (m, p) => send(m, p, sessionId);
const js = async (expr) => (await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

let cur = {};
async function load(hash, w, h, reduced = false) {
  // a fresh tab for every load: long runs of software WebGL otherwise wear the renderer out
  if (targetId) await send('Target.closeTarget', { targetId }).catch(() => {});
  ({ targetId } = await send('Target.createTarget', { url: 'about:blank' }));
  ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }));
  await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable');
  events.length = 0;
  await S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: w < 700 ? 2 : 1, mobile: w < 700 });
  await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
  cur = { w, h };
  await S('Page.navigate', { url: base + '#' + hash });
  for (let i = 0; i < 100 && !events.some((e) => e.method === 'Page.loadEventFired'); i++) await sleep(100);
  await js('Promise.race([document.fonts.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 4000))])');
  await sleep(500);
}
const problems = () => events.filter((e) =>
  e.method === 'Runtime.exceptionThrown' ||
  (e.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(e.params.type)) ||
  (e.method === 'Log.entryAdded' && ['error', 'warning'].includes(e.params.entry.level) && !/Tracking Prevention/.test(e.params.entry.text)))
  .map((e) => (e.params.exceptionDetails?.exception?.description || e.params.exceptionDetails?.text || e.params.args?.map((a) => a.value).join(' ') || e.params.entry?.text || '').split(/\n/).slice(0, 2).join(' ')).filter((v, i, a) => a.indexOf(v) === i);
const mouse = (type, x, y, buttons = 0) => S('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? (buttons ? 'left' : 'none') : 'left', buttons, clickCount: type === 'mouseMoved' ? 0 : 1 });
async function path(pts, ms = 900, buttons = 0) { // smooth Catmull-Rom path through points (fractions of viewport)
  const P = pts.map(([x, y]) => [x * cur.w, y * cur.h]), steps = Math.round(ms / 16);
  for (let i = 0; i <= steps; i++) {
    const f = (i / steps) * (P.length - 1), k = Math.min(P.length - 2, Math.floor(f)), t = f - k;
    const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(P.length - 1, k + 2)];
    const c = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t * t + (-a + 3 * b - 3 * cc + d) * t * t * t);
    await mouse('mouseMoved', c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), buttons);
    await sleep(16);
  }
}
const click = async (x, y) => { await mouse('mouseMoved', x * cur.w, y * cur.h); await mouse('mousePressed', x * cur.w, y * cur.h, 1); await sleep(40); await mouse('mouseReleased', x * cur.w, y * cur.h); };
async function shot(file) {
  const { data } = await S('Page.captureScreenshot', { format: 'png' });
  mkdirSync(join(dir, 'stills'), { recursive: true });
  writeFileSync(join(dir, 'stills', file), Buffer.from(data, 'base64'));
  console.log('  still', file);
}
const overflow = () => js(`(() => { const s = document.querySelector('.scene.on'); return { doc: document.documentElement.scrollWidth - innerWidth, scene: s.scrollWidth - s.clientWidth, sceneH: s.scrollHeight, vh: innerHeight }; })()`);

// The pointer choreography per 404, so the effect shows in a still.
const ACT = {
  '404-1': async () => { // a long horseshoe pour round the copy (never doubling back), a drop where it ends, then the still while the ink is fresh
    await path([[.05, .94], [.1, .74], [.05, .54], [.11, .34], [.19, .16], [.35, .1], [.5, .15], [.65, .1], [.81, .16], [.9, .34], [.95, .54], [.89, .74], [.95, .94]], 4800);
    await click(.93, .86); await sleep(700); },
  '404-2': async () => { await path([[.2, .25], [.45, .35], [.66, .3], [.72, .4]], 1400); await path([[.72, .4], [.6, .78], [.42, .82], [.3, .76]], 900); await click(.36, .8); await sleep(700); },
  '404-3': async () => { await path([[.3, .66], [.42, .6], [.55, .64], [.66, .57], [.72, .6]], 500); await click(.17, .3); await sleep(140); await click(.83, .3); await sleep(380); },
  '404-4': async () => { await path([[.2, .2], [.4, .3], [.5, .26]], 900); await sleep(900); },
  '404-5': async () => { await path([[.5, .5], [.3, .4]], 300); const b = await js(`(() => { const r = document.querySelector('#s-404-5 [data-o=note]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    await mouse('mouseMoved', b[0], b[1]); await mouse('mousePressed', b[0], b[1], 1);
    for (let i = 1; i <= 14; i++) { await mouse('mouseMoved', b[0] + i * 9, b[1] + i * 13, 1); await sleep(16); }
    await mouse('mouseReleased', b[0] + 126, b[1] + 182); await sleep(260); await path([[.3, .4], [.7, .3]], 500); await sleep(300); },
};
// approved page: the lens, mid-pulse; and the phone frame, steered from outside (the mouse reaches the framed page)
ACT['404'] = async () => { await path([[.2, .2], [.4, .3], [.5, .26]], 900); await click(.5, .26); await sleep(320); };
const phoneRect = () => js(`(() => { const r = document.querySelector('.ph-scr').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
ACT['404/phone'] = async () => { await sleep(1500); const [x, y, w, h] = await phoneRect(), P = (fx, fy) => [(x + w * fx) / cur.w, (y + h * fy) / cur.h];
  await path([P(.15, .25), P(.4, .32), P(.62, .3)], 900); const c = P(.62, .3); await click(c[0], c[1]); await sleep(320); };
// the framed page's own frame times: its default execution context, found among the target's contexts
async function frameStats() {
  const main = (await S('Page.getFrameTree')).frameTree.frame.id;
  const ctx = events.filter((e) => e.method === 'Runtime.executionContextCreated' && e.params.context.auxData?.isDefault && e.params.context.auxData.frameId !== main).pop();
  if (!ctx) return null;
  const ev = (expression) => S('Runtime.evaluate', { expression, contextId: ctx.params.context.id, awaitPromise: true, returnByValue: true }).then((r) => r.result.value);
  await ev('window.__states.clear()'); await sleep(1500); return ev('window.__states.stats()');
}
const ALL = AP ? ['404', '404/phone', 'between', 'use'] : ['404-1', '404-2', '404-3', '404-4', '404-5', 'load-1', 'load-1/use', 'load-2', 'load-2/use', 'load-3', 'load-3/use', 'load-4', 'load-4/use', 'load-5', 'load-5/use'];

try {
  if (mode === 'contrast' || mode === 'objects') {
    // contrast: hide the copy, screenshot what sits behind each line, and rate it against the text colour. It passes on the 2nd
    // percentile: the worst pixels are the 1 px grid dots (canvas mixed with 12 % ink), the same dots as the approved Studio canvas.
    // objects: Lost objects at rest must stay clear of the header, and the header must stay on top of a flung object.
    const out = [];
    for (const [w, h] of [[1280, 800], [1440, 900], [390, 844]]) {
      if (mode === 'objects') {
        await load('404-5&clean', w, h); await sleep(2500);
        const rest = await js(`(() => { const b = document.querySelector('#s-404-5 .brand').getBoundingClientRect(), hd = document.querySelector('#s-404-5 .p-head').getBoundingClientRect();
          return [...document.querySelectorAll('#s-404-5 .lo')].filter((o) => o.offsetParent).map((o) => { const r = o.getBoundingClientRect();
            return { o: o.dataset.o, top: Math.round(r.top), headBottom: Math.round(hd.bottom), clearOfHeader: r.top >= hd.bottom, hitsLogo: !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom) }; }); })()`);
        // fling the note onto the logo and check what is on top there
        const n = await js(`(() => { const r = document.querySelector('#s-404-5 [data-o=note]').getBoundingClientRect(), b = document.querySelector('#s-404-5 .brand').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, b.left + b.width * .4, b.top + b.height / 2]; })()`);
        await mouse('mouseMoved', n[0], n[1]); await mouse('mousePressed', n[0], n[1], 1);
        for (let i = 1; i <= 12; i++) { await mouse('mouseMoved', lerp(n[0], n[2], i / 12), lerp(n[1], n[3], i / 12), 1); await sleep(16); }
        const onTop = await js(`(() => { const b = document.querySelector('#s-404-5 .brand').getBoundingClientRect(), e = document.elementFromPoint(b.left + b.width * .4, b.top + b.height / 2); const nr = document.querySelector('#s-404-5 [data-o=note]').getBoundingClientRect(); return { noteOverLogo: !(nr.right < b.left || nr.left > b.right || nr.bottom < b.top || nr.top > b.bottom), topmostAtLogo: e.closest('.brand') ? 'logo' : e.closest('.lo') ? 'object' : e.className }; })()`);
        await mouse('mouseReleased', n[2], n[3]);
        out.push({ w, rest, dragOverLogo: onTop });
        continue;
      }
      await load('404-1&clean', w, h); await ACT['404-1']();
      const rects = await js(`(() => { const s = document.querySelector('#s-404-1'), q = (sel, need) => [...s.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return { sel, need, color: getComputedStyle(e).color, r: [r.left, r.top, r.width, r.height] }; });
        const list = [...q('.p-main > .eyebrow', 4.5), ...q('.p-h > span:not(.grey)', 3), ...q('.p-h > .grey', 3), ...q('.p-sub', 4.5), ...q('.tlink', 4.5), ...q('.p-svc > .eyebrow', 4.5)];
        const st = document.createElement('style'); st.id = 'qa-hide'; st.textContent = '#s-404-1 .p-main, #s-404-1 .p-main *, #s-404-1 .p-svc > .eyebrow { color: transparent !important; text-decoration-color: transparent !important; } #s-404-1 .p-main .pill { visibility: hidden }'; document.head.appendChild(st);
        return list; })()`);
      const { data } = await S('Page.captureScreenshot', { format: 'png' });
      const res = await js(`(async () => { document.getElementById('qa-hide').remove();
        const img = new Image(); img.src = 'data:image/png;base64,${data}'; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const k = img.width / innerWidth, lin = (v) => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }, L = (r, gg, b) => .2126 * lin(r) + .7152 * lin(gg) + .0722 * lin(b);
        return ${JSON.stringify(rects)}.map((t) => { const [x, y, w, h] = t.r.map((v) => Math.round(v * k)), d = g.getImageData(x, y, Math.max(1, w), Math.max(1, h)).data, m = t.color.match(/[\\d.]+/g).map(Number), Lt = L(m[0], m[1], m[2]);
          const rs = []; for (let i = 0; i < d.length; i += 4) { const Lb = L(d[i], d[i + 1], d[i + 2]); rs.push((Math.max(Lb, Lt) + .05) / (Math.min(Lb, Lt) + .05)); }
          rs.sort((a, b) => a - b); return { text: t.sel, need: t.need, worst: +rs[0].toFixed(2), p1: +rs[Math.floor(rs.length * .01)].toFixed(2), p2: +rs[Math.floor(rs.length * .02)].toFixed(2), pass: rs[Math.floor(rs.length * .02)] >= t.need }; }); })()`);
      out.push({ w, lines: res });
      await shot(`_contrast-${w}.png`);
    }
    console.log(JSON.stringify(out, null, 1));
    writeFileSync(join(here, `qa-${mode}.json`), JSON.stringify(out, null, 1));
  } else if (mode === 'eval') {
    const [hash, expr, act] = args; await load(hash, 1440, 900);
    if (act) await (new Function('click', 'path', 'sleep', 'return (async () => {' + act + '})()'))(click, path, sleep);
    console.log(JSON.stringify(await js(expr), null, 1)); console.log(problems());
  } else if (mode === 'shot') {
    const [hash, w, h, file, act] = args; await load(hash, +w, +h, hash.includes('still'));
    if (act === 'act' && ACT[hash.split('&')[0]]) await ACT[hash.split('&')[0]]();
    else if (act) await (new Function('click', 'path', 'sleep', 'return (async () => {' + act + '})()'))(click, path, sleep);
    else await sleep(1200);
    await shot(file); console.log(problems());
  } else if (mode === 'check') {
    const rows = [];
    // one browser per width and motion setting: node qa.mjs check [1440|390] [motion|still]
    const sizes = [[1440, 900], [390, 844]].filter(([w]) => !args[0] || +args[0] === w), modes = [false, true].filter((r) => !args[1] || (args[1] === 'still') === r);
    for (const [w, h] of sizes) for (const reduced of modes) for (const hash of ALL) try {
      console.log('·', w, reduced ? 'still' : 'motion', hash);
      await load(hash + '&clean', w, h, reduced);
      if (ACT[hash] && !reduced) await ACT[hash](); else await sleep(1500);
      await js('window.__states.clear()'); await sleep(1500);
      let st = await js('window.__states.stats()'), framed = false;
      if (hash.endsWith('/phone') && !st.n) { const f = await frameStats(); if (f) { st = f; framed = true; } }
      const of = await overflow(), pr = problems();
      rows.push({ w, reduced, hash: hash + (framed ? ' (framed page)' : ''), errors: pr.length, overflowX: Math.max(of.doc, of.scene), tall: of.sceneH > of.vh ? of.sceneH - of.vh : 0, jsAvg: +st.avg.toFixed(2), jsP95: +st.p95.toFixed(2), frames: st.n });
      if (pr.length) console.log(w, reduced ? 'still' : 'motion', hash, pr);
    } catch (e) { rows.push({ w, reduced, hash, errors: 'QA: ' + e.message }); }
    console.table(rows);
    const file = join(dir, 'qa-report.json'), prev = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    const keep = prev.filter((p) => !rows.some((r) => r.w === p.w && r.reduced === p.reduced && r.hash === p.hash));
    writeFileSync(file, JSON.stringify([...keep, ...rows], null, 1));
  } else if (mode === 'stills' && AP) {
    const only = args[0];
    const L = [ // [hash, w, h, file, how]: 'act' runs the pointer path, a number paints the ripple at that time, 'board' captures the full height
      ['404', 1440, 900, '01-404-desktop.png', 'act'], ['404', 1440, 900, '02-404-desktop-still.png', 'still'],
      ['404', 390, 844, '03-404-phone.png', 'act'], ['404', 390, 844, '04-404-phone-still.png', 'still'],
      ['404/phone', 1440, 900, '05-404-phone-frame.png', 'act'],
      // the pulse on the 1.2 s ratchet clock: k = floor((T + .9) / 1.2); even k fills out, odd k drains back. Exactly mid-way the two
      // are the same picture (same front radius, moving the other way), so both are taken 40 % into their run (.209 s): front 40 % out, then 60 % out.
      ['between', 1440, 900, '06-between-filling.png', 1.709], ['between', 1440, 900, '07-between-black.png', 2.3], ['between', 1440, 900, '08-between-draining.png', 2.909],
      ['between', 1440, 900, '09-between-still.png', 'still'],
      ['use', 1440, 900, '10-board.png', 'board'], ['use', 390, 844, '11-board-mobile.png', 'board'],
    ];
    for (const [hash, w, h, file, how] of L) {
      if (only && !file.startsWith(only)) continue;
      try {
        await load(hash + '&clean', w, h, how === 'still');
        if (how === 'act') await ACT[hash]();
        else if (typeof how === 'number') { await sleep(800); await js(`window.__states.pause(); window.__states.scene('load-5').paint(${how})`); await sleep(100); }
        else if (how === 'board') { await sleep(2600); const H = await js("document.querySelector('.scene.on').scrollHeight"); await S('Emulation.setDeviceMetricsOverride', { width: w, height: H, deviceScaleFactor: w < 700 ? 2 : 1, mobile: w < 700 }); await sleep(900); }
        else await sleep(1200);
        await shot(file);
        const pr = problems(); if (pr.length) console.log('   problems:', pr);
      } catch (e) { console.log('  FAILED', file, e.message); }
    }
  } else if (mode === 'stills') {
    const only = args[0];
    const L = [
      ['404-1', 1440, 900, '01-404-ink-in-water.png'], ['404-2', 1440, 900, '02-404-aurora.png'], ['404-3', 1440, 900, '03-404-fireworks.png'], ['404-4', 1440, 900, '04-404-dot-lens.png'], ['404-5', 1440, 900, '05-404-lost-objects.png'],
      ['load-1', 1440, 900, '06-load-rotor-spool.png', 2.6], ['load-1/use', 1440, 900, '07-load-rotor-spool-in-use.png', 2.2],
      ['load-2', 1440, 900, '08-load-blade-index.png', 1.6], ['load-2/use', 1440, 1100, '09-load-blade-index-in-use.png', 1.6],
      ['load-3', 1440, 900, '10-load-hold-dial.png', 3.4], ['load-3/use', 1440, 900, '11-load-hold-dial-in-use.png', 3.4],
      ['load-4', 1440, 900, '12-load-skeleton.png', 1.1], ['load-4/use', 1440, 900, '13-load-skeleton-in-use.png', 1.1],
      ['load-5', 1440, 900, '14-load-dot-ripple.png', 1.9], ['load-5/use', 1440, 900, '15-load-dot-ripple-in-use.png', 1.9],
      ['404-1', 390, 844, '21-404-ink-in-water-mobile.png'], ['404-2', 390, 844, '22-404-aurora-mobile.png'], ['404-3', 390, 844, '23-404-fireworks-mobile.png'], ['404-4', 390, 844, '24-404-dot-lens-mobile.png'], ['404-5', 390, 844, '25-404-lost-objects-mobile.png'],
      ['load-1', 390, 844, '26-load-rotor-spool-mobile.png', 2.6], ['load-2', 390, 844, '27-load-blade-index-mobile.png', 1.6], ['load-3', 390, 844, '28-load-hold-dial-mobile.png', 3.4], ['load-4', 390, 844, '29-load-skeleton-mobile.png', 1.1], ['load-5', 390, 844, '30-load-dot-ripple-mobile.png', 1.9],
      ['404-1', 1440, 900, '41-404-ink-in-water-still.png', 0, true], ['404-2', 1440, 900, '42-404-aurora-still.png', 0, true], ['404-3', 1440, 900, '43-404-fireworks-still.png', 0, true], ['404-4', 1440, 900, '44-404-dot-lens-still.png', 0, true], ['404-5', 1440, 900, '45-404-lost-objects-still.png', 0, true],
      ['load-1', 1440, 900, '46-load-rotor-spool-still.png', 1, true], ['load-2', 1440, 900, '47-load-blade-index-still.png', 1, true], ['load-3', 1440, 900, '48-load-hold-dial-still.png', 1, true], ['load-4', 1440, 900, '49-load-skeleton-still.png', 1, true], ['load-5', 1440, 900, '50-load-dot-ripple-still.png', 1, true],
    ];
    for (const [hash, w, h, file, wait, reduced] of L) {
      if (only && !file.startsWith(only)) continue;
      try {
      await load(hash + '&clean', w, h, !!reduced);
      if (ACT[hash] && !reduced) await ACT[hash](); else await sleep((wait || 1) * 1000);
      await shot(file);
      const pr = problems(); if (pr.length) console.log('   problems:', pr);
      } catch (e) { console.log('  FAILED', file, e.message); }
    }
  }
} finally {
  ws.close(); proc.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
