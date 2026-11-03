// Route C (Claude 09 §4.4): capture one selector's box from the presentation pack, or run an eval report.
// Built only on the pack's own cdp.mjs (openBrowser -> load, evalJs, S). Opens only the local index.html.
//
//   node capture.mjs <exportRoot> <hash> <selector> <width> <scale> <settled|motion|reduced> [tabs=N] [keys=a,b] [scroll=f] [nth=i] [pre=<js>] [eval=list|targets|nontext|ax] [wait=ms] <file>
//   node capture.mjs <exportRoot> --jobs <jobs.json> <outDir>      (same fields per job; one browser for all jobs)
//
// Fails, and writes no file, on a selector that matches nothing or a box with zero width or height.
// The single-colour check runs afterwards over the PNGs (check.py), because Node has no PNG decoder here.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const [root, ...rest] = process.argv.slice(2);
const { openBrowser, sleep } = await import(pathToFileURL(join(root, 'planning/design/pack/src/cdp.mjs')).href);
const url = pathToFileURL(join(root, 'planning/design/pack/index.html')).href;

function parse(args) {
  const [hash, sel, w, scale, media, ...more] = args;
  const job = { hash, sel, width: +w, scale: +scale, media, file: more.pop() };
  for (const m of more) { const [k, v] = m.split('='); job[k] = v; }
  return job;
}
let jobs, outDir = '';
if (rest[0] === '--jobs') { jobs = JSON.parse(readFileSync(rest[1], 'utf8')); outDir = rest[2]; }
else jobs = [parse(rest)];

const settle = `(function(){document.documentElement.classList.remove('motion');document.querySelectorAll('[data-reveal]').forEach(function(e){e.classList.add('in')});var f=document.getElementById('hero');if(f&&!f.srcdoc)f.srcdoc=f.getAttribute('data-srcdoc');return true})()`;
const evals = {
  list: `(function(){return [].slice.call(document.querySelectorAll('[id^="s-"]')).map(function(g){return {group:g.id,
    phones:g.querySelectorAll('figure.phone').length,
    states:[].slice.call(g.querySelectorAll('.states > .state')).map(function(s,i){var n=s.querySelector('header .n');return {n:i+1,label:n?n.textContent.replace(/^[\\s·]+/,'').trim():''}})}})})()`,
  targets: `(function(){return [].slice.call(document.querySelectorAll('a,button,input,select,textarea,[role=button],[tabindex]')).filter(function(e){return e.getClientRects().length&&!e.closest('#intro')}).map(function(e){var r=e.getBoundingClientRect();return {tag:e.tagName,text:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,40),w:Math.round(r.width),h:Math.round(r.height),under24:r.width<24||r.height<24,under44:r.width<44||r.height<44}})})()`,
  svgtext: `(function(){var out=[];[].slice.call(document.querySelectorAll('svg')).filter(function(v){return v.querySelector('text')&&v.getClientRects().length&&!v.closest('#intro')}).forEach(function(v,i){var R=v.getBoundingClientRect();[].slice.call(v.querySelectorAll('text')).forEach(function(t){var r=t.getBoundingClientRect();if(!r.width)return;var cs=getComputedStyle(t);out.push({svg:i,text:t.textContent.trim().slice(0,30),fill:cs.fill,px:parseFloat(cs.fontSize),weight:cs.fontWeight,x:r.left-R.left+16,y:r.top-R.top+16,w:r.width,h:r.height})})});return out})()`,
  nontext: `(function(){function bg(e){for(;e;e=e.parentElement){var c=getComputedStyle(e).backgroundColor;if(c&&!/rgba\\(0, 0, 0, 0\\)|transparent/.test(c))return c}return 'rgb(242, 241, 238)'}
    return [].slice.call(document.querySelectorAll('a,button,input,select,textarea,[role=button]')).filter(function(e){return e.getClientRects().length&&!e.closest('#intro')}).map(function(e){var cs=getComputedStyle(e);return {tag:e.tagName,text:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,40),border:cs.borderTopWidth+' '+cs.borderTopStyle+' '+cs.borderTopColor,outline:cs.outlineWidth+' '+cs.outlineStyle+' '+cs.outlineColor,fill:cs.backgroundColor,backdrop:bg(e.parentElement)}})})()`,
};

const b = await openBrowser();
const log = [];
for (const j of jobs) {
  const file = join(outDir, j.file);
  try {
    const media = j.media === 'reduced' ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [{ name: 'prefers-reduced-motion', value: 'no-preference' }];
    await b.load(url + (j.hash || '#skip'), j.width, j.scale, media);
    if (j.media === 'settled') { await b.evalJs(settle); await sleep(500); } else await sleep(+(j.wait || 3500));
    if (j.eval === 'ax') {
      await b.S('Accessibility.enable');
      const { nodes } = await b.S('Accessibility.getFullAXTree');
      const slim = nodes.filter((n) => !n.ignored).map((n) => ({ role: n.role?.value, name: n.name?.value })).filter((n) => n.name || /button|link|heading|textbox/.test(n.role));
      mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(slim, null, 1));
      log.push({ ok: true, file: j.file, nodes: slim.length }); continue;
    }
    if (j.eval) {
      const v = await b.evalJs(evals[j.eval]);
      mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(v, null, 1));
      log.push({ ok: true, file: j.file, items: v.length }); continue;
    }
    if (j.pre) { await b.evalJs(j.pre); await sleep(300); }
    if (j.tabs) for (let i = 0; i < +j.tabs; i++) { await b.S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await b.S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await sleep(120); }
    if (j.keys) for (const k of j.keys.split(',')) {
      const code = { Enter: 13, Escape: 27, Tab: 9, Space: 32 }[k];
      await b.S('Input.dispatchKeyEvent', { type: 'keyDown', key: k === 'Space' ? ' ' : k, code: k, windowsVirtualKeyCode: code });
      await b.S('Input.dispatchKeyEvent', { type: 'keyUp', key: k === 'Space' ? ' ' : k, code: k, windowsVirtualKeyCode: code }); await sleep(400);
    }
    let sel = j.sel;
    if (sel === ':focus') { sel = null; }
    if (j.scroll !== undefined) {
      await b.evalJs(`(function(){var e=document.querySelector(${JSON.stringify(sel)});var r=e.getBoundingClientRect(),t=r.top+scrollY;scrollTo(0,t+${+j.scroll}*Math.max(0,r.height-innerHeight));return true})()`);
      await sleep(1200);
    }
    const box = await b.evalJs(`(function(){var e=${sel ? `document.querySelectorAll(${JSON.stringify(sel)})[${+(j.nth||0)}]` : 'document.activeElement'};if(!e||e===document.body)return null;
      var r=e.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height,vy:scrollY,vh:innerHeight,label:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,40)}})()`);
    if (!box) throw new Error('selector matched nothing');
    if (!(box.w > 0 && box.h > 0)) throw new Error(`zero-size box ${box.w}x${box.h}`);
    // Scrolled captures show the viewport (what the reader sees); the rest clip the element with a 16 px margin.
    const pad = j.sel === ':focus' ? 24 : 16;
    const clip = j.scroll !== undefined
      ? { x: 0, y: box.vy, width: j.width, height: box.vh, scale: 1 }
      : { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(j.width - Math.max(0, box.x - pad), box.w + 2 * pad), height: box.h + 2 * pad, scale: 1 };
    const { data } = await b.S('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: j.scroll === undefined });
    mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, Buffer.from(data, 'base64'));
    log.push({ ok: true, file: j.file, clip, label: box.label });
  } catch (e) { log.push({ ok: false, file: j.file, error: String(e.message || e) }); }
}
await b.close();
console.log(JSON.stringify(log, null, 1));
