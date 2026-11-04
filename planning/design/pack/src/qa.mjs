// Automated checks for the pack in a local headless Chrome or Edge. Results feed QA.md.
//
//   node planning/design/pack/src/qa.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openBrowser, sleep } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(here, '..', 'index.html')).href;
const b = await openBrowser();
const settle = `document.documentElement.classList.remove('motion');document.querySelectorAll('[data-reveal]').forEach(function(e){e.classList.add('in')});true`;

// 1. Layout per viewport: page overflow, and the five shortcuts on the home phone (equal, above a 640 px fold).
const layout = `(function(){
  var de=document.documentElement, w=innerWidth;
  var wide=[].slice.call(document.querySelectorAll('body *')).filter(function(e){var r=e.getBoundingClientRect();
    if(!(r.width>0 && r.right>w+1))return false;
    if(e.closest('.tscroll,.floats,#intro,.sheet,.dash-glow')||e.closest('svg'))return false;
    var p=getComputedStyle(e).position; return p!=='absolute'&&p!=='fixed'}).map(function(e){return e.tagName+'.'+e.className});
  var scr=document.querySelector('#s-home .scr'), sc=[].slice.call(scr.querySelectorAll('.sc')), top=scr.getBoundingClientRect().top;
  var h=sc.map(function(e){return Math.round(e.getBoundingClientRect().height)});
  return {width:w, pageOverflow:de.scrollWidth>w, elementsPastEdge:wide.slice(0,5), screenWidth:scr.clientWidth,
    shortcutHeights:h, equal:Math.max.apply(0,h)-Math.min.apply(0,h)<=1, lastShortcutBottom:Math.round(sc[4].getBoundingClientRect().bottom-top)};
})()`;
for (const [w, h] of [[360, 640], [390, 844], [768, 1024], [1280, 800], [1440, 900], [720, 450]]) {
  await b.S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 });
  await b.load(url + '#skip', w);
  await b.S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 });
  await sleep(300); await b.evalJs(settle);
  console.log('layout', `${w}x${h}`, JSON.stringify(await b.evalJs(layout)));
}

// 2. Text contrast: every element with its own text, against its composited background.
// Translucent layers are blended down to the canvas; for gradients the worst colour stop counts.
for (const w of [1440, 390]) {
  await b.load(url + '#skip', w); await b.evalJs(settle); await sleep(400);
  const contrast = await b.evalJs(`(function(){
    function parse(s){var m=s.match(/rgba?\\(([^)]+)\\)/);if(!m)return null;var p=m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);return [p[0],p[1],p[2],p.length>3?p[3]:1]}
    function stops(s){return (s.match(/rgba?\\([^)]+\\)/g)||[]).map(parse)}
    function over(top,base){var a=top[3];return [top[0]*a+base[0]*(1-a),top[1]*a+base[1]*(1-a),top[2]*a+base[2]*(1-a),1]}
    function lum(c){return [0,1,2].map(function(i){var v=c[i]/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}).reduce(function(a,v,i){return a+v*[.2126,.7152,.0722][i]},0)}
    function layers(e){var L=[];for(;e;e=e.parentElement){var cs=getComputedStyle(e);
      if(cs.backgroundImage.indexOf('gradient')>=0&&!/radial-gradient\\(circle at 1px 1px/.test(cs.backgroundImage)){L.push({g:stops(cs.backgroundImage)});}
      var c=parse(cs.backgroundColor);if(c&&c[3]>0){L.push({c:c});if(c[3]>=.99)break}}
      return L}
    function candidates(e){var L=layers(e),base=[[242,241,238,1]];
      for(var i=L.length-1;i>=0;i--){var l=L[i];
        if(l.c){base=base.map(function(b){return l.c[3]>=.99?l.c:over(l.c,b)})}
        else if(l.g.length){var nb=[];base.forEach(function(b){l.g.forEach(function(s){nb.push(over(s,b))})});base=nb}}
      return base}
    var out=[],n=0;
    [].slice.call(document.querySelectorAll('body *')).forEach(function(e){
      if(e.closest('svg,.sr,#intro,.sheet')||!e.getClientRects().length)return;
      var cs=getComputedStyle(e);if(cs.visibility==='hidden'||+cs.opacity===0)return;
      var own=[].slice.call(e.childNodes).some(function(t){return t.nodeType===3&&t.textContent.trim()});
      if(!own)return; n++;
      var fg=parse(cs.color),px=parseFloat(cs.fontSize),bold=+cs.fontWeight>=700,need=(px>=24||(px>=18.66&&bold))?3:4.5;
      var worst=99;candidates(e).forEach(function(b){var f=fg[3]<1?over(fg,b):fg,a=lum(f),c=lum(b),r=(Math.max(a,c)+.05)/(Math.min(a,c)+.05);if(r<worst)worst=r});
      if(worst<need)out.push({text:e.textContent.trim().slice(0,40),ratio:+worst.toFixed(2),need:need,px:px});
    });
    return {checked:n,fails:out.slice(0,20),failCount:out.length};
  })()`);
  console.log('contrast', w, JSON.stringify(contrast));
}

// 3. Focus: real Tab presses; every stop must show a ring of at least 2 px, in DOM order, with nothing hidden.
await b.load(url + '#skip', 1440); await b.evalJs(settle);
const tab = async (shift) => { const p = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: shift ? 8 : 0 }; await b.S('Input.dispatchKeyEvent', { type: 'keyDown', ...p }); await b.S('Input.dispatchKeyEvent', { type: 'keyUp', ...p }); await sleep(30); };
const stops = [];
for (let i = 0; i < 80; i++) {
  await tab();
  const s = await b.evalJs(`(function(){var e=document.activeElement;if(!e||e===document.body)return null;var cs=getComputedStyle(e),r=e.getBoundingClientRect();
    var all=[].slice.call(document.querySelectorAll('*'));
    return {label:(e.getAttribute('aria-label')||e.textContent||e.tagName).trim().slice(0,32),idx:all.indexOf(e),ring:cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>=2,outline:cs.outlineWidth+' '+cs.outlineColor,visible:r.width>0&&r.height>0&&cs.visibility!=='hidden'}})()`);
  if (!s) break;
  if (stops.length && s.idx === stops[0].idx) break;
  stops.push(s);
}
const order = stops.every((s, i) => i === 0 || s.idx > stops[i - 1].idx);
console.log('focus', JSON.stringify({ stops: stops.length, inDomOrder: order, allRings: stops.every((s) => s.ring), allVisible: stops.every((s) => s.visible), noRing: stops.filter((s) => !s.ring).map((s) => s.label), first: stops.slice(0, 10).map((s) => s.label), last: stops.slice(-6).map((s) => s.label) }));
// compact menu at 390: focus trap and Esc
await b.load(url + '#skip', 390);
const menu = await b.evalJs(`(async function(){var bt=document.querySelector('.menu-btn');bt.focus();bt.click();await new Promise(function(r){setTimeout(r,450)});
  var o={expanded:bt.getAttribute('aria-expanded'),first:document.activeElement.textContent.trim()};return o})()`);
for (let i = 0; i < 8; i++) await tab();
menu.afterEightTabs = await b.evalJs(`document.activeElement.closest('#menu')?'in sheet':document.activeElement.className`);
await b.S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await b.S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await sleep(500);
menu.afterEsc = await b.evalJs(`({expanded:document.querySelector('.menu-btn').getAttribute('aria-expanded'),focus:document.activeElement.className,sheet:getComputedStyle(document.querySelector('#menu')).visibility})`);
console.log('menu', JSON.stringify(menu));

// 4. Reduced motion: the intro is a still that goes away, nothing drifts, reveals are visible, the film holds a still frame.
const heroFrames = async () => {
  await b.evalJs(`(function(){var f=document.getElementById('hero');f.srcdoc=f.getAttribute('data-srcdoc');return true})()`);
  await sleep(2200);
  const c = await b.evalJs(`document.getElementById('hero').contentDocument.getElementById('s').innerHTML`);
  await sleep(500);
  const d = await b.evalJs(`document.getElementById('hero').contentDocument.getElementById('s').innerHTML`);
  return c === d;
};
for (const pref of ['reduce', 'no-preference']) {
  await b.load(url, 1440, 1, [{ name: 'prefers-reduced-motion', value: pref }]);
  await sleep(500);
  const early = await b.evalJs(`({introShown:document.documentElement.classList.contains('intro-on'),rotor:document.getElementById('i-rotor-rot').getAttribute('transform')})`);
  await sleep(1200);
  const mid = await b.evalJs(`document.getElementById('i-rotor-rot').getAttribute('transform')`);
  await sleep(4000);
  const after = await b.evalJs(`({introGone:document.documentElement.classList.contains('intro-done'),motionClass:document.documentElement.classList.contains('motion'),drift:getComputedStyle(document.querySelector('.obj')).animationName,scroll:getComputedStyle(document.documentElement).scrollBehavior,hidden:[].slice.call(document.querySelectorAll('[data-reveal]')).filter(function(e){return getComputedStyle(e).opacity==='0'}).length})`);
  console.log('motion', pref, JSON.stringify({ ...early, rotorStill: early.rotor === mid, ...after, filmStill: await heroFrames() }));
}

// 5. Network: nothing but the file itself and data: URIs.
await b.load(url + '#skip', 1440); await sleep(1500);
console.log('resources', JSON.stringify(await b.evalJs(`performance.getEntriesByType('resource').map(function(e){return e.name}).filter(function(n){return !/^(data:|file:|about:)/.test(n)})`)));
await b.close();
