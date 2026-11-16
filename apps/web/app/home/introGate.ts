/**
 * The first-visit intro's inline gate. It runs while the page is parsed (it
 * is tiny and inline, so it never waits on the network): on a first visit
 * without reduced motion it covers the page at once and marks the container
 * for public/intro/intro.js, which loads `async` and animates. If that script
 * never starts, the cover lifts after 4 s so the page is never left hidden.
 */
export const INTRO_GATE = `(function(){try{if(localStorage.getItem('cx-intro-seen')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;var e=document.getElementById('cx-intro');if(!e)return;e.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#0d0f12;transition:opacity .45s ease';e.hidden=false;e.setAttribute('data-play','1');setTimeout(function(){if(!e.hasAttribute('data-started')){e.hidden=true;e.style.cssText='';}},4000)}catch(_){}})();`;
