// Automated checks for the pack in a local headless Chrome or Edge. Results feed QA.md.
//
//   node planning/design/pack/src/qa.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openBrowser, sleep } from './cdp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(here, '..', 'index.html')).href;
const b = await openBrowser();

// 1. Layout per viewport: page overflow and the five shortcuts on the home mockup.
const layout = `(function(){
  var de=document.documentElement, w=innerWidth;
  var wide=[].slice.call(document.querySelectorAll('body *')).filter(function(e){var r=e.getBoundingClientRect();
    return r.width>0 && r.right>w+1 && !e.closest('.tscroll') && getComputedStyle(e).position!=='absolute'}).length;
  var scr=document.querySelector('#s-home .scr'), sc=[].slice.call(scr.querySelectorAll('.sc')), top=scr.getBoundingClientRect().top+8;
  var h=sc.map(function(e){return Math.round(e.getBoundingClientRect().height)});
  return {width:w, pageOverflow:de.scrollWidth>w, elementsPastEdge:wide, screenWidth:scr.clientWidth,
    shortcutHeights:h, equal:Math.max.apply(0,h)-Math.min.apply(0,h)<=1,
    lastShortcutBottom:Math.round(sc[4].getBoundingClientRect().bottom-top)};
})()`;
for (const w of [360, 390, 720, 768, 1440]) {
  await b.load(url, w);
  console.log('layout', JSON.stringify(await b.evalJs(layout)));
}

// 2. Text contrast: every element with its own text, against its nearest opaque background.
await b.load(url, 1440);
const contrast = await b.evalJs(`(function(){
  function rgb(s){var m=s.match(/[\\d.]+/g);return m?m.map(Number):null}
  function lum(c){return [0,1,2].map(function(i){var v=c[i]/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}).reduce(function(a,v,i){return a+v*[.2126,.7152,.0722][i]},0)}
  function bg(e){for(;e;e=e.parentElement){var cs=getComputedStyle(e);
    if(cs.backgroundImage.indexOf('gradient')>=0)return [28,33,40];
    var c=rgb(cs.backgroundColor);if(c&&(c.length<4||c[3]>0.9))return c}return [255,255,255]}
  var out=[],n=0;
  [].slice.call(document.querySelectorAll('body *')).forEach(function(e){
    if(e.closest('svg')||e.closest('.sr')||!e.getClientRects().length)return;
    var own=[].slice.call(e.childNodes).some(function(t){return t.nodeType===3&&t.textContent.trim()});
    if(!own)return; n++;
    var cs=getComputedStyle(e),fg=rgb(cs.color),b=bg(e),a=lum(fg),c=lum(b);
    var r=(Math.max(a,c)+.05)/(Math.min(a,c)+.05),px=parseFloat(cs.fontSize),bold=+cs.fontWeight>=700;
    var need=(px>=24||(px>=18.66&&bold))?3:4.5;
    if(r<need)out.push({text:e.textContent.trim().slice(0,40),ratio:+r.toFixed(2),need:need,color:cs.color,bg:b.join(',')});
  });
  return {checked:n,fails:out};
})()`);
console.log('contrast', JSON.stringify(contrast));

// 3. Reduced motion: the hero must show its still logo at once, and smooth scrolling must be off.
const heroFrames = async () => {
  await b.evalJs(`(function(){var f=document.getElementById('hero');f.srcdoc=f.getAttribute('data-srcdoc');return true})()`);
  await sleep(700);
  const a = await b.evalJs(`document.getElementById('hero').contentDocument.getElementById('s').innerHTML.length`);
  await sleep(1500);
  const c = await b.evalJs(`document.getElementById('hero').contentDocument.getElementById('s').innerHTML`);
  await sleep(500);
  const d = await b.evalJs(`document.getElementById('hero').contentDocument.getElementById('s').innerHTML`);
  return { stillBetween2and2_7s: c === d, firstFrameLength: a };
};
await b.load(url, 1440, 1, [{ name: 'prefers-reduced-motion', value: 'reduce' }]);
console.log('reduced', JSON.stringify({ ...(await heroFrames()), scrollBehavior: await b.evalJs(`getComputedStyle(document.documentElement).scrollBehavior`) }));
await b.load(url, 1440, 1, [{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
console.log('motion', JSON.stringify({ ...(await heroFrames()), scrollBehavior: await b.evalJs(`getComputedStyle(document.documentElement).scrollBehavior`) }));

// 4. Network: nothing but the file itself and data: URIs.
console.log('resources', JSON.stringify(await b.evalJs(`performance.getEntriesByType('resource').map(function(e){return e.name}).filter(function(n){return !/^(data:|file:|about:)/.test(n)})`)));
await b.close();
