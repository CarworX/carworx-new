// GENERATED from the Sites preview home (#83 @ b88a8ca). D-097: the browse-first
// home has no timeline or written-quote section, so those parts only run if present.
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

  // The brand intro (app/home/introGate.ts, public/intro/intro.js) is the only
  // intro. The hero animates straight away.
  finishIntro();

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
  if (tlSec) drawBooking(0);

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
  gstage?.addEventListener('pointerdown', (e) => { kick(); dragging = true; moved = 0; dx0 = e.clientX; pos0 = pos; gstage.setPointerCapture(e.pointerId); });
  gstage?.addEventListener('pointermove', (e) => { if (!dragging) return; moved = Math.max(moved, Math.abs(e.clientX - dx0)); target = pos = pos0 - (e.clientX - dx0) / spacing(); vel = 0; });
  const endDrag = (e) => {
    if (!dragging) return; dragging = false;
    // a short swipe still turns one card
    const dx = e && e.clientX !== undefined ? e.clientX - dx0 : 0;
    target = Math.abs(dx) > 40 && Math.abs(pos - pos0) < .5 ? Math.round(pos0) - Math.sign(dx) : Math.round(pos);
    lastMove = now();
  };
  gstage?.addEventListener('pointerup', endDrag); gstage?.addEventListener('pointercancel', endDrag);
  gstage?.addEventListener('pointerenter', () => hover = true); gstage?.addEventListener('pointerleave', () => hover = false);
  if (gstage) new IntersectionObserver((es) => { if (es[0].isIntersecting && !inView) lastMove = now(); inView = es[0].isIntersecting; kick(); }).observe(gstage);
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
    if (!cPath) return; // the chart is not on the page any more (the glimpse and the old dashboard are gone)
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
    if (days.length) ScrollTrigger.create({ trigger: '#quote', start: 'top 75%', end: 'bottom 60%', scrub: .6,
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
    G.fromTo('.ill svg', { scale: 1.08 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.ill', start: 'top bottom', end: 'center center', scrub: true } });
  } else {
    $$('#days i').forEach((d) => d.style.setProperty('--f', 1));
  }


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
  $$('[data-loop]').forEach((el) => loopIO.observe(el)); if (tlSec) loopIO.observe(tlSec);
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', () => { lastP = -1; kick(); });
  kick();
})();
