// GENERATED from the Sites preview home (#83 @ b88a8ca), verbatim.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G = window.gsap && window.ScrollTrigger ? window.gsap : null;
  const motion = !!G && !RM;
  if (G) G.registerPlugin(ScrollTrigger);
  if (motion) root.classList.add('motion', 'hero-wait');
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  let heroVis = true, tlVis = false;
  // per-frame writers go through these, so unchanged values never invalidate style
  const css = (el, p, v) => { const c = el.__c || (el.__c = {}); if (c[p] !== v) { c[p] = v; el.style[p] = v; } };
  const attr = (el, p, v) => { const c = el.__a || (el.__a = {}); if (c[p] !== v) { c[p] = v; el.setAttribute(p, v); } };
  const text = (el, v) => { if (el.__t !== v) { el.__t = v; el.textContent = v; } };
  const svgEl = (n, a) => { const e = document.createElementNS('http://www.w3.org/2000/svg', n); for (const k in a) e.setAttribute(k, a[k]); return e; };

  /* ---------- gauge ticks ---------- */
  const ticks = $('#gticks');
  for (let i = 0; i <= 20; i++) {
    const a = (-135 + i * 13.5) * Math.PI / 180, r1 = i % 5 ? 70 : 64, r2 = 76;
    ticks.appendChild(svgEl('line', { x1: 100 + r1 * Math.sin(a), y1: 100 - r1 * Math.cos(a), x2: 100 + r2 * Math.sin(a), y2: 100 - r2 * Math.cos(a) }));
  }

  /* ---------- live hero hold timer ---------- */
  const heroRing = $('#heroRing'), heroClock = $('#heroClock');
  let heroLeft = 14 * 60 + 32;
  const tickHero = () => {
    if (heroVis) {
      heroClock.textContent = mmss(heroLeft);
      heroRing.setAttribute('stroke-dashoffset', (490.1 * (1 - heroLeft / 900)).toFixed(1));
    }
    heroLeft = heroLeft > 0 ? heroLeft - 1 : 900;
  };
  tickHero(); if (!RM) setInterval(tickHero, 1000);

  /* ---------- intro: full-scale glyph resolve + Turbine spool inside a concentric housing ---------- */
  // Rotor physics follow brand/motion/timeline.mjs: lag-surge-brake spool, 1.8° overshoot, damped spring to rest.
  const REST = 21.9494, TURNS = 3, OVER = 1.8;
  const TABLE = (() => { const n = 1024, c = new Float64Array(n + 1);
    for (let i = 1; i <= n; i++) { const u = (i - .5) / n; c[i] = c[i - 1] + Math.pow(u, 2.2) * Math.pow(1 - u, 1.3); }
    for (let i = 0; i <= n; i++) c[i] /= c[n]; return c; })();
  const spool = (u) => { const x = clamp(u) * 1024, i = Math.floor(x), f = x - i; return i >= 1024 ? 1 : TABLE[i] + (TABLE[i + 1] - TABLE[i]) * f; };
  const SP = [0.3, 2.0];
  const rotorAngle = (t) => t < SP[1]
    ? REST - (TURNS * 360 + OVER) * (1 - spool((t - SP[0]) / (SP[1] - SP[0]))) + OVER
    : REST + OVER * Math.exp(-6.5 * (t - SP[1])) * Math.cos(2 * Math.PI * 1.7 * (t - SP[1]));
  const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
  const lerp = (a, b, k) => a + (b - a) * k;

  const intro = $('#intro'), stage = $('#intro .stage');
  const asm = $('#i-asm'), rotS = $('#i-rotor-s'), rotRot = $('#i-rotor-rot'), word = $('#i-word');
  const ghosts = $$('#i-rotor-rot .ghost');
  const slots = $$('.glyph-slot'), igs = $$('#intro .ig');
  const housing = $('#intro .housing'), pressure = $('#intro .pressure');
  const tickWrap = $('#i-ticks'), tickEls = [];
  for (let i = 0; i < 72; i++) {
    const a = i * 5 * Math.PI / 180, r1 = i % 6 ? 106 : 104, r2 = i % 6 ? 110 : 114;
    tickEls.push(tickWrap.appendChild(svgEl('line', { x1: (r1 * Math.sin(a)).toFixed(2), y1: (-r1 * Math.cos(a)).toFixed(2), x2: (r2 * Math.sin(a)).toFixed(2), y2: (-r2 * Math.cos(a)).toFixed(2), opacity: 0 })));
  }
  const HC = 2 * Math.PI * 100;
  housing.setAttribute('stroke-dasharray', HC.toFixed(1));
  const RES = [0.8, 0.9, 0.99, 1.09, 1.19, 1.28, 1.4];
  const CH = '0123456789R#%&*+=<>/{}[]?$@ABCDEHKMNPRSTVWXZ'.split('');
  // Layout: L = 1 is the horizontal lockup (export transforms); L = 0 is the stacked export, mapped into the same frame.
  const STACK = innerWidth < 600, K = 1.15;
  let L = STACK ? 0 : 1;
  if (STACK) stage.classList.add('stacked');
  const T_END = 2.95;

  function drawIntro(t) {
    // where the two halves sit (stacked export: mark at 303.18,160 ×1.6, wordmark at 0,480; centred on the horizontal frame)
    const ax = lerp(426.18, 92, L), ay = lerp(92 - 80 * K, 92, L), as = lerp(1.6 * K / 0.92, 1, L);
    const wx = lerp(426.18 - 303.18 * K, 246, L), wy = lerp(92 + 240 * K, 142, L), ws = lerp(K, 1, L);
    asm.setAttribute('transform', `translate(${ax.toFixed(2)},${ay.toFixed(2)}) scale(${as.toFixed(4)})`);
    word.setAttribute('transform', `translate(${wx.toFixed(2)},${wy.toFixed(2)}) scale(${ws.toFixed(4)})`);
    // glyph slots: fade in, scramble, resolve to the outlined glyph
    slots.forEach((s, i) => {
      const on = clamp((t - 0.05 - i * 0.04) / 0.2), r = clamp((t - RES[i]) / 0.14);
      s.setAttribute('opacity', (on * (1 - r)).toFixed(3));
      if (t < RES[i]) s.textContent = CH[(Math.floor(t * 22) * 7 + i * 13 + Math.floor(t * 9) * i) % CH.length];
      const g = clamp((t - RES[i] + 0.04) / 0.42), e = easeOutCubic(g);
      igs[i].setAttribute('opacity', e.toFixed(3));
      igs[i].setAttribute('transform', `translate(0 ${((1 - e) * 26).toFixed(2)})`);
    });
    // housing ring and ticks draw around the seat; they stay concentric with the rotor and fade once it seats
    const ringOut = 1 - clamp((t - 2.0) / 0.45);
    housing.setAttribute('stroke-dashoffset', (HC * (1 - easeOutCubic(clamp(t / 0.6)))).toFixed(1));
    housing.setAttribute('opacity', ringOut.toFixed(3));
    tickEls.forEach((el, i) => el.setAttribute('opacity', (clamp((t - 0.08 - i * 0.008) / 0.12) * ringOut * (i % 6 ? .55 : 1)).toFixed(3)));
    // rotor grows into its housing while it spools up, then seats with a damped spring
    const grow = easeOutCubic(clamp((t - 0.3) / 1.2));
    rotS.setAttribute('transform', `scale(${(0.92 * (0.5 + 0.5 * grow)).toFixed(4)})`);
    rotS.setAttribute('opacity', clamp((t - 0.3) / 0.3).toFixed(3));
    const a = rotorAngle(t);
    rotRot.setAttribute('transform', `rotate(${a.toFixed(3)})`);
    // motion blur: trailing copies spread by angular speed
    const v = Math.abs(a - rotorAngle(t - 1 / 60));
    const spread = Math.min(16, v * 0.9);
    ghosts.forEach((gh, k) => {
      gh.setAttribute('transform', `rotate(${(-(k + 1) * spread / 4).toFixed(2)})`);
      gh.setAttribute('opacity', (spread > .4 ? 0.28 - k * 0.05 : 0).toFixed(3));
    });
    // pressure ring leaves the rotor as it seats
    const p = clamp((t - 2.0) / 0.8);
    pressure.setAttribute('transform', `scale(${(1 + 2 * easeOutCubic(p)).toFixed(4)})`);
    pressure.setAttribute('opacity', (p > 0 && p < 1 ? 0.5 * (1 - p) : 0).toFixed(3));
  }

  function heroIn() {
    root.classList.remove('hero-wait');
    if (!motion) return;
    const far = Math.min(innerWidth * .32, 460);
    const tl = G.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('.hero h1 .ln>span', { yPercent: 105 }, { yPercent: 0, duration: 1.2, stagger: .1 }, 0)
      .fromTo('.hero [data-hero]', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.1, stagger: .05 }, .1)
      .fromTo('.obj', { opacity: 0 }, { opacity: 1, duration: .5, stagger: .05 }, 0)
      .fromTo('.obj-in', { x: (i, el) => +el.parentNode.dataset.side * far, y: 40, scale: .7, rotation: (i) => [-14, 10, -8, 12, 18, -10][i] },
        { x: 0, y: 0, scale: 1, rotation: 0, duration: 1.6, ease: 'elastic.out(1,.75)', stagger: .06 }, 0)
      .fromTo('.key', { opacity: 0, y: 48 }, { opacity: 1, y: 0, duration: 1, ease: 'back.out(1.7)', stagger: .06 }, .3);
  }

  function finishIntro() {
    root.classList.remove('intro-on', 'logo-wait'); root.classList.add('intro-done');
    if (root.classList.contains('hero-wait')) heroIn();
    if (G) ScrollTrigger.refresh();
  }

  function runIntro() {
    const hashT = /intro=([\d.]+)/.exec(location.hash);
    if (!G || /skip/.test(location.hash)) { L = 1; drawIntro(9); finishIntro(); return; }
    if (RM) {
      // Reduced motion: the intro becomes a still of the settled lockup, then fades away.
      drawIntro(9); root.classList.add('intro-on');
      const done = () => { G.to(intro, { opacity: 0, duration: .4, onComplete: finishIntro }); };
      const id = setTimeout(done, 1400); intro.addEventListener('click', () => { clearTimeout(id); done(); }, { once: true });
      return;
    }
    root.classList.add('intro-on', 'logo-wait');
    const st = { t: 0 };
    const tl = G.timeline({ onComplete: handoff });
    tl.to(st, { t: T_END, duration: T_END, ease: 'none', onUpdate: () => drawIntro(st.t) }, 0)
      .fromTo('.intro-tag .w>span', { yPercent: 110 }, { yPercent: 0, duration: .8, stagger: .07, ease: 'expo.out' }, 1.5)
      .fromTo('.intro-roll', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .6, ease: 'expo.out' }, 1.8)
      .to('.roll-track', { y: '-1.3em', duration: .26, ease: 'power3.inOut' }, 2.0)
      .to('.roll-track', { y: '-2.6em', duration: .26, ease: 'power3.inOut' }, 2.24)
      .to('.roll-track', { y: '-3.9em', duration: .26, ease: 'power3.inOut' }, 2.48)
      .fromTo('.intro-skip', { opacity: 0 }, { opacity: 1, duration: .5 }, .4);
    drawIntro(0);
    if (hashT) { tl.pause(+hashT[1]); drawIntro(+hashT[1]); return; } // used for stills
    const skip = () => { if (tl.progress() < 1) tl.timeScale(5); };
    ['wheel', 'touchstart', 'keydown', 'click'].forEach((e) => addEventListener(e, skip, { once: true, passive: true }));

    function handoff() {
      // FLIP: the full-scale lockup shrinks into the nav while the hero objects spring in from the edges.
      const lk = $('#intro .lk'), nav = $('.nav .logo svg');
      const a = lk.getBoundingClientRect(), b = nav.getBoundingClientRect();
      const s = b.width / a.width, lay = { l: L };
      const ht = G.timeline({ onComplete: finishIntro });
      ht.to('.intro-sub,.intro-skip', { opacity: 0, y: -12, duration: .3, ease: 'power2.in' }, 0)
        .to(lay, { l: 1, duration: .55, ease: 'expo.inOut', onUpdate: () => { L = lay.l; drawIntro(T_END + 1); } }, 0)
        .to(lk, { x: b.left - a.left, y: b.top - a.top, scale: s, duration: .9, ease: 'expo.inOut' }, .05)
        .fromTo('.nav', { opacity: 0 }, { opacity: 1, duration: .5, ease: 'power1.out' }, .2)
        .to('#intro .ibg', { opacity: 0, duration: .45, ease: 'power1.out' }, .4)
        .add(() => { root.classList.remove('intro-on'); heroIn(); }, .3);
    }
  }
  runIntro();

  /* ---------- hero objects: depth parallax (pointer + scroll) ---------- */
  const hero = $('.hero');
  const objs = $$('.obj');
  let mx = 0, my = 0, cx = 0, cy = 0, scales = [];
  const readScales = () => { scales = objs.map((o) => parseFloat(getComputedStyle(o).getPropertyValue('--s')) || 1); };
  readScales(); addEventListener('resize', readScales);
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; if (heroVis) kick(); }, { passive: true });
  const placeObjs = () => {
    cx += (mx - cx) * .06; cy += (my - cy) * .06;
    const sy = Math.min(scrollY, innerHeight * 1.2);
    objs.forEach((o, i) => {
      const d = +o.dataset.depth, side = +o.dataset.side;
      const x = cx * 34 * d + side * sy * .08 * d, y = cy * 26 * d - sy * .22 * d;
      css(o, 'transform', `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${scales[i]})`);
    });
    return Math.abs(mx - cx) + Math.abs(my - cy) > .001;
  };
  placeObjs();

  /* ---------- service keys: the matching floating object reacts ---------- */
  $$('.key').forEach((k) => {
    const a = $('a', k), on = () => { hero.dataset.hot = k.dataset.k; }, off = () => { delete hero.dataset.hot; };
    a.addEventListener('pointerenter', on); a.addEventListener('pointerleave', off);
    a.addEventListener('focus', on); a.addEventListener('blur', off);
  });

  /* ---------- signature: the booking travels the timeline, morphing as it goes ---------- */
  const tlSec = $('#how'), tlStage = $('.tl-stage'), bk = $('.bk'), ground = $('.bk-ground');
  const faces = $$('.bk-face'), fcs = faces.map((f) => f.firstElementChild);
  const tlSteps = $$('.tl-steps li'), tlDots = $$('.tl-dot'), tlFill = $('.tl-fill');
  const tlRing = $('#tlRing'), tlClock = $('#tlClock'), rLines = $$('.f3 .rl');
  const SHAPES = [{ w: 208, h: 208, rot: -4 }, { w: 312, h: 136, rot: 2 }, { w: 220, h: 220, rot: 0 }, { w: 248, h: 300, rot: -2 }];
  const STOPS = [.125, .375, .625, .875];
  const tlLive = $('#tlLive');
  let pT = 0, pC = 0, lastP = -1, lastOn = 0;
  const smooth01 = (x) => x * x * (3 - 2 * x);
  // Only transforms and opacity are written here: the four faces cross-fade while scaling toward one shared size,
  // and each face's content is counter-scaled so its text never stretches.
  function drawBooking(p) {
    const i = Math.min(2, Math.floor(p)), f = p - i, A = SHAPES[i], B = SHAPES[i + 1];
    const mix = (k) => A[k] + (B[k] - A[k]) * f;
    const mobile = innerWidth <= 900, W = tlStage.clientWidth;
    const bs = mobile ? Math.min(.86, (W - 24) / 330) : 1;
    const x = mobile ? W / 2 : W * (STOPS[i] + (STOPS[i + 1] - STOPS[i]) * f);
    const lift = RM ? 0 : Math.sin(Math.PI * f);
    const w = mix('w'), h = mix('h');
    css(bk, 'transform', `translate3d(${x.toFixed(1)}px,${(-lift * 40).toFixed(1)}px,0) rotate(${(mix('rot') - lift * 5).toFixed(2)}deg) scale(${(bs * (1 + lift * .05)).toFixed(3)})`);
    css(ground, 'transform', `translate3d(${x.toFixed(1)}px,0,0) scaleX(${(w / 200 * bs * (1 - lift * .25)).toFixed(3)})`);
    css(ground, 'opacity', (1 - lift * .55).toFixed(3));
    faces.forEach((el, k) => {
      const S = SHAPES[k], sx = w / S.w, sy = h / S.h, d = Math.abs(p - k), cs = 1 - Math.min(d, 1) * .12;
      const o = clamp(1 - d * 2.4);
      css(el, 'opacity', o.toFixed(3));
      if (o > 0) { css(el, 'transform', `translate(-50%,-50%) scale(${sx.toFixed(4)},${sy.toFixed(4)})`); css(fcs[k], 'transform', `scale(${(cs / sx).toFixed(4)},${(cs / sy).toFixed(4)})`); }
    });
    css(tlFill, 'transform', `scaleX(${(p / 3).toFixed(4)})`);
    tlDots.forEach((d, k) => d.classList.toggle('on', p >= k - .02));
    const on = Math.round(p); tlSteps.forEach((s, k) => s.classList.toggle('on', k === on));
    if (on !== lastOn) { lastOn = on; tlLive.textContent = `Step ${on + 1} of 4. ${$('h3', tlSteps[on]).textContent}. ${$('p', tlSteps[on]).textContent}`; }
    // the hold counts down as you scroll through step 3
    const secs = 900 - Math.round(clamp((p - 1.7) / 1.1) * 74);
    text(tlClock, mmss(secs));
    attr(tlRing, 'stroke-dashoffset', (527.8 * (1 - secs / 900)).toFixed(1));
    // the receipt prints line by line on arrival
    rLines.forEach((el, j) => { const v = RM ? (p > 2.5 ? 1 : 0) : clamp((p - 2.45 - j * .05) / .2); css(el, 'opacity', v.toFixed(3)); css(el, 'transform', `translateY(${((1 - v) * 6).toFixed(1)}px)`); });
  }
  const readTimeline = () => {
    const r = tlSec.getBoundingClientRect();
    if (r.bottom < -200 || r.top > innerHeight + 200) return false;
    const s = clamp(-r.top / (r.height - innerHeight));
    const x = clamp(s * 3.3 - .15, 0, 3), i = Math.min(2, Math.floor(x)), f = x - i;
    pT = i + smooth01(clamp((f - .22) / .56));
    return true;
  };
  drawBooking(0);

  /* ---------- product glimpse carousel (Lightspark-style focus) ---------- */
  const gstage = $('#gstage'), cards = $$('.gcard'), tabs = $$('.gtabs button');
  const N = cards.length;
  let pos = 0, target = 0, vel = 0, dragging = false, dx0 = 0, pos0 = 0, hover = false, inView = false, lastMove = 0, moved = 0;
  const wrapD = (d) => ((d % N) + N * 1.5) % N - N / 2;
  const spacing = () => innerWidth < 760 ? Math.min(240, innerWidth * .62) : 320;
  const now = () => performance.now() / 1000;
  const layoutCards = () => {
    const sp = spacing(), t = now();
    cards.forEach((c, i) => {
      const d = wrapD(i - pos), a = Math.abs(d);
      // neighbours read as depth: gentle scale, a little blur, mostly opaque
      const sc = 1 - Math.min(a, 2) * .1;
      const bl = Math.round(Math.min(a, 2) * 1.2 * 5) / 5;
      const op = clamp(1 - Math.max(0, a - 1) * .3);
      const y = a * 28 + (RM ? 0 : Math.sin(t * .8 + i * 1.7) * 6 * Math.min(a, 1));
      css(c, 'transform', `translate3d(${(d * sp).toFixed(1)}px,${y.toFixed(1)}px,0) scale(${sc.toFixed(3)}) rotate(${(d * -1.6).toFixed(2)}deg)`);
      css(c, 'filter', bl > .2 ? `blur(${bl.toFixed(1)}px) saturate(${(1 - Math.min(a, 2) * .06).toFixed(2)})` : 'none');
      css(c, 'opacity', op.toFixed(2));
      css(c, 'zIndex', String(100 - Math.round(a * 10)));
      attr(c, 'aria-hidden', a > .5 ? 'true' : 'false');
    });
    const ai = ((Math.round(target) % N) + N) % N;
    tabs.forEach((b, i) => attr(b, 'aria-selected', String(i === ai)));
  };
  const goTo = (i) => { const cur = ((Math.round(target) % N) + N) % N; target = Math.round(target) + wrapD(i - cur); lastMove = now(); };
  tabs.forEach((b, i) => b.addEventListener('click', () => goTo(i)));
  cards.forEach((c, i) => c.addEventListener('click', () => { if (moved < 6 && Math.abs(wrapD(i - pos)) > .4) goTo(i); }));
  gstage.addEventListener('pointerdown', (e) => { kick(); dragging = true; moved = 0; dx0 = e.clientX; pos0 = pos; gstage.setPointerCapture(e.pointerId); });
  gstage.addEventListener('pointermove', (e) => { if (!dragging) return; moved = Math.max(moved, Math.abs(e.clientX - dx0)); target = pos = pos0 - (e.clientX - dx0) / spacing(); vel = 0; });
  const endDrag = (e) => {
    if (!dragging) return; dragging = false;
    // a short swipe still turns one card
    const dx = e && e.clientX !== undefined ? e.clientX - dx0 : 0;
    target = Math.abs(dx) > 40 && Math.abs(pos - pos0) < .5 ? Math.round(pos0) - Math.sign(dx) : Math.round(pos);
    lastMove = now();
  };
  gstage.addEventListener('pointerup', endDrag); gstage.addEventListener('pointercancel', endDrag);
  gstage.addEventListener('pointerenter', () => hover = true); gstage.addEventListener('pointerleave', () => hover = false);
  new IntersectionObserver((es) => { if (es[0].isIntersecting && !inView) lastMove = now(); inView = es[0].isIntersecting; kick(); }).observe(gstage);
  addEventListener('keydown', (e) => { if (!inView) return; if (e.key === 'ArrowRight') { target = Math.round(target) + 1; } if (e.key === 'ArrowLeft') { target = Math.round(target) - 1; } });
  layoutCards();

  /* ---------- dashboard: tabs, chart morph, counters ---------- */
  const DATA = [[6, 4, 7, 5, 8, 14, 9], [22, 28, 25, 34, 30, 41, 38]];
  const LABELS = [['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7']];
  const cPath = $('#cPath'), cArea = $('#cArea'), cDot = $('#cDot'), cxl = $('#cx');
  let cur = DATA[0].slice(), draw = motion ? 0 : 1;
  const pts = (vals) => { const mx = Math.max(...vals) * 1.15; return vals.map((v, i) => [i * 100, 210 - (v / mx) * 190]); };
  const smooth = (p) => { let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) { const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]},${p2[1].toFixed(1)}`; }
    return d; };
  const renderChart = () => {
    const p = pts(cur), d = smooth(p);
    cPath.setAttribute('d', d); cArea.setAttribute('d', `${d} L600,220 L0,220Z`);
    const Lp = cPath.getTotalLength();
    cPath.style.strokeDasharray = Lp; cPath.style.strokeDashoffset = Lp * (1 - draw);
    const pt = cPath.getPointAtLength(Lp * draw);
    cDot.setAttribute('cx', pt.x); cDot.setAttribute('cy', pt.y);
    cArea.style.opacity = draw;
  };
  renderChart();
  const setRange = (r) => {
    $$('#ctabs button').forEach((b, i) => b.setAttribute('aria-selected', String(i === r)));
    cxl.innerHTML = LABELS[r].map((l) => `<span>${l}</span>`).join('');
    const from = cur.slice(), to = DATA[r], o = { k: 0 };
    const step = () => { cur = from.map((v, i) => v + (to[i] - v) * o.k); renderChart(); };
    if (G && !RM) G.to(o, { k: 1, duration: 1, ease: 'expo.inOut', onUpdate: step }); else { o.k = 1; step(); }
  };
  $$('#ctabs button').forEach((b, i) => b.addEventListener('click', () => setRange(i)));
  $$('#dtabs button').forEach((b, i) => b.addEventListener('click', () => {
    $$('#dtabs button').forEach((x, j) => x.setAttribute('aria-selected', String(i === j)));
    $$('.qpanel').forEach((p, j) => p.classList.toggle('on', i === j));
  }));

  /* ---------- scroll choreography ---------- */
  if (motion) {
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%', once: true,
      onEnter: (els) => G.to(els, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out', stagger: .08 }),
    });
    $$('.h2').forEach((h) => G.to($$('.ln>span', h), { yPercent: 0, y: 0, duration: 1.2, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: h, start: 'top 85%', once: true } }));
    // the quote's 7-day validity fills as you read
    const days = $$('#days i');
    ScrollTrigger.create({ trigger: '#quote', start: 'top 75%', end: 'bottom 60%', scrub: .6,
      onUpdate: (s) => days.forEach((d, i) => d.style.setProperty('--f', clamp(s.progress * 7 - i).toFixed(3))) });
    // dashboard: chart draws, numbers count up, the glow breathes with scroll
    ScrollTrigger.create({ trigger: '.dash', start: 'top 75%', once: true, onEnter: () => {
      const o = { k: 0 };
      G.to(o, { k: 1, duration: 1.8, ease: 'expo.out', onUpdate: () => { draw = o.k; renderChart(); } });
      $$('.dash [data-count]').forEach((el) => {
        const n = +el.dataset.count, c = { v: 0 };
        G.to(c, { v: n, duration: 1.8, ease: 'expo.out', onUpdate: () => {
          el.textContent = el.dataset.fmt === 'hm' ? `${Math.floor(c.v / 60)}h${String(Math.round(c.v % 60)).padStart(2, '0')}` : fmt(c.v);
        } });
      });
    } });
    G.fromTo('.dash-glow', { scale: .9, rotate: -4 }, { scale: 1.05, rotate: 3, ease: 'none', scrollTrigger: { trigger: '.dash-wrap', start: 'top bottom', end: 'bottom top', scrub: true } });
    G.fromTo('.gblob.b1', { x: -60 }, { x: 60, ease: 'none', scrollTrigger: { trigger: '#glimpse', start: 'top bottom', end: 'bottom top', scrub: true } });
    G.fromTo('.gblob.b2', { x: 60 }, { x: -60, ease: 'none', scrollTrigger: { trigger: '#glimpse', start: 'top bottom', end: 'bottom top', scrub: true } });
    G.fromTo('.ill svg', { scale: 1.08 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.ill', start: 'top bottom', end: 'center center', scrub: true } });
  } else {
    $$('#days i').forEach((d) => d.style.setProperty('--f', 1));
  }

  /* ---------- compact menu (900 px and below): frosted sheet, focus trap, Esc to close ---------- */
  const menuBtn = $('.menu-btn'), sheet = $('#menu'), scrim = $('.scrim');
  const setMenu = (open, focusBack) => {
    sheet.classList.toggle('open', open); scrim.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    root.classList.toggle('menu-open', open);
    if (open) $('a', sheet).focus(); else if (focusBack) menuBtn.focus();
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true', true));
  scrim.addEventListener('click', () => setMenu(false, true));
  $$('a', sheet).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => {
    if (!sheet.classList.contains('open')) return;
    if (e.key === 'Escape') { e.preventDefault(); setMenu(false, true); return; }
    if (e.key !== 'Tab') return;
    const items = [menuBtn, ...$$('a', sheet)], first = items[0], last = items[items.length - 1];
    if (!items.includes(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  matchMedia('(min-width: 901px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });

  /* ---------- one rAF loop for the springy bits; it sleeps when nothing it drives is moving or on screen ---------- */
  let running = false;
  function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }
  function loop() {
    let busy = false;
    if (!RM && heroVis && placeObjs()) busy = true;
    // booking timeline: eased toward the scroll position (reduced motion snaps to whole steps)
    if (tlVis && readTimeline()) {
      pC = RM ? Math.round(pT) : (Math.abs(pT - pC) < .0005 ? pT : pC + (pT - pC) * .16);
      if (pC !== lastP) { drawBooking(pC); lastP = pC; }
      if (pC !== pT) busy = true;
    }
    // carousel: damped spring toward the target card, autoplay while visible
    if (!dragging) {
      if (!RM && inView && !hover && now() - lastMove > 3.6) { target = Math.round(target) + 1; lastMove = now(); }
      if (RM) pos = target; else { vel += (target - pos) * .075; vel *= .74; pos += vel; }
    }
    if (inView || dragging) { layoutCards(); busy = true; }
    if (busy) requestAnimationFrame(loop); else running = false;
  }
  // off-screen sections pause their CSS loops; the rAF loop only runs for what is visible
  const loopIO = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (e.target.hasAttribute('data-loop')) e.target.classList.toggle('off', !e.isIntersecting);
      if (e.target === hero) heroVis = e.isIntersecting;
      if (e.target === tlSec) tlVis = e.isIntersecting;
    });
    kick();
  }, { rootMargin: '120px 0px' });
  $$('[data-loop]').forEach((el) => loopIO.observe(el)); loopIO.observe(tlSec);
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { lastP = -1; kick(); });
  kick();
})();
