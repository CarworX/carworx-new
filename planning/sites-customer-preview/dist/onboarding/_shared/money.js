/* CarworX money view (prototype, synthetic data). One component for businesses and admins:
 * an all-time hero figure, a period filter bar (past week / month / year / custom), stat
 * tiles with the change against the previous period of the same length, a column chart
 * with hover + keyboard tooltips and a table view, and ranked breakdown bars.
 * Usage: MONEY.mount(el, { scope: "business" | "platform" | "one", name, seed }). */
(() => {
  const { esc } = window.OB;
  const DAY = 864e5;
  const TODAY = Date.UTC(2026, 10, 12); // 12 Nov 2026 (SAST date)
  const START = Date.UTC(2024, 10, 12); // synthetic history starts two years back
  const rand = (seed) => () => ((seed = (seed + 0x6d2b79f5) | 0), (((seed ^ (seed >>> 15)) * (1 | seed)) >>> 0) / 4294967296);
  const R = (n) => "R" + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
  const Rk = (n) => (n >= 1e6 ? `R${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}m` : n >= 1e3 ? `R${Math.round(n / 1e3)}k` : R(n));
  const N = (n) => Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
  const fmtD = (t, o) => new Date(t).toLocaleDateString("en-ZA", { timeZone: "UTC", ...o });

  // Daily synthetic series: weekly rhythm, growth, noise. Platform = many businesses.
  function series(scope, seed) {
    const rnd = rand(seed);
    const days = [];
    const big = scope === "platform";
    for (let t = START, i = 0; t <= TODAY; t += DAY, i++) {
      const dow = new Date(t).getUTCDay();
      const growth = 1 + (i / 730) * (big ? 1.6 : 0.45);
      const week = [1.25, 0.7, 0.85, 0.9, 1, 1.15, 1.45][dow];
      const avg = big ? 310 : 290;
      const n = Math.max(0, Math.round((big ? 160 : 5.2) * growth * week * (0.75 + rnd() * 0.5)));
      days.push({ t, n, v: n * avg * (0.85 + rnd() * 0.3), biz: big ? Math.round(18 + i * 0.16) : 0 });
    }
    return days;
  }
  const SPLIT = {
    business: [["By service", [["Wash & Detailing", 0.71], ["Glass Repair & Replacement", 0.29]]], ["By team member", [["Lerato", 0.46], ["Thabo", 0.39], ["Sipho", 0.15]]]],
    one: [["By service", [["Wash & Detailing", 0.71], ["Glass Repair & Replacement", 0.29]]]],
    platform: [["Top businesses", [["Karoo Glass Fix", 0.09, "KG"], ["Pinetown Valet Co.", 0.075, "PV"], ["Shine Bay Car Wash", 0.06], ["Jacaranda Tyre & Align", 0.055], ["Kloof Detailing", 0.04]]], ["By service", [["Wash & Detailing", 0.38], ["Repairs & Maintenance", 0.27], ["Tyres & Wheel Alignment", 0.17], ["Glass Repair & Replacement", 0.12], ["Fines & Vehicle Admin", 0.06]]]],
  };

  function sum(days, a, b) {
    let v = 0, n = 0, biz = 0;
    for (const d of days) if (d.t >= a && d.t <= b) (v += d.v), (n += d.n), (biz = Math.max(biz, d.biz));
    return { v, n, biz };
  }
  function range(p, from, to) {
    if (p === "custom") {
      const a = Date.parse(from + "T00:00:00Z"), b = Date.parse(to + "T00:00:00Z");
      if (!(a <= b)) return null;
      const len = b - a + DAY;
      return { a, b, pa: a - len, pb: a - DAY, prev: "the previous period of the same length" };
    }
    const len = { week: 7, month: 30, year: 365 }[p] * DAY;
    return { a: TODAY - len + DAY, b: TODAY, pa: TODAY - 2 * len + DAY, pb: TODAY - len, prev: `the previous ${p}` };
  }
  function buckets(days, a, b) {
    const span = (b - a) / DAY + 1;
    const unit = span <= 31 ? "day" : span <= 120 ? "week" : "month";
    const out = [];
    const key = (t) => {
      if (unit === "day") return t;
      if (unit === "week") return a + Math.floor((t - a) / (7 * DAY)) * 7 * DAY;
      const d = new Date(t);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    };
    for (const d of days) {
      if (d.t < a || d.t > b) continue;
      const k = key(d.t);
      let bk = out.at(-1);
      if (!bk || bk.k !== k) out.push((bk = { k, v: 0, n: 0, from: d.t, to: d.t }));
      bk.v += d.v; bk.n += d.n; bk.to = d.t;
    }
    return { unit, out };
  }
  const delta = (cur, prev, prevLabel, money) => {
    if (!prev) return `<p class="mn-delta flat"><span>New this period</span></p>`;
    const p = ((cur - prev) / prev) * 100;
    const up = p >= 0.05, down = p <= -0.05;
    const arrow = up ? '<path d="M6 10V2M2.5 5.5 6 2l3.5 3.5"/>' : down ? '<path d="M6 2v8M2.5 6.5 6 10l3.5-3.5"/>' : '<path d="M2 6h8"/>';
    return `<p class="mn-delta ${up ? "up" : down ? "down" : "flat"}"><span class="pill"><svg viewBox="0 0 12 12" aria-hidden="true">${arrow}</svg>${up ? "+" : down ? "−" : ""}${Math.abs(p).toFixed(1)}%</span><span class="vs">vs ${esc(prevLabel)} · ${money ? R(prev) : Math.round(prev).toLocaleString("en-ZA").replace(/,/g, " ")}</span><span class="cx-vh">${up ? "Up" : down ? "Down" : "No change"}</span></p>`;
  };

  function mount(el, cfg) {
    const days = series(cfg.scope === "platform" ? "platform" : "business", cfg.seed || 7);
    const plat = cfg.scope === "platform";
    const state = { p: "month", from: "2026-10-01", to: "2026-10-31", table: false };
    const all = sum(days, START, TODAY);
    function render() {
      const r = range(state.p, state.from, state.to);
      const cur = r ? sum(days, r.a, r.b) : { v: 0, n: 0 };
      const prev = r ? sum(days, r.pa, r.pb) : { v: 0, n: 0 };
      const words = { week: "Past week", month: "Past month", year: "Past year", custom: "Custom" };
      const tiles = plat
        ? [["Booking value", R(cur.v), delta(cur.v, prev.v, r?.prev, true)], ["CarworX fees", "R0", `<p class="mn-delta flat"><span>Pilot fee is R0. Fees would show here.</span></p>`], ["Completed bookings", cur.n.toLocaleString("en-ZA").replace(/,/g, " "), delta(cur.n, prev.n, r?.prev)], ["Active businesses", String(cur.biz), delta(cur.biz, prev.biz, r?.prev)]]
        : [["Earned", R(cur.v), delta(cur.v, prev.v, r?.prev, true)], ["Completed bookings", N(cur.n), delta(cur.n, prev.n, r?.prev)], ["Average booking", cur.n ? R(cur.v / cur.n) : "–", delta(cur.n ? cur.v / cur.n : 0, prev.n ? prev.v / prev.n : 0, r?.prev, true)]];
      const bk = r ? buckets(days, r.a, r.b) : { unit: "day", out: [] };
      el.innerHTML = `
        <section class="mn-hero"><p class="cx-eyebrow">${plat ? "Booking value through CarworX, all time" : cfg.scope === "one" ? `${esc(cfg.name)} · earned on CarworX, all time` : "Earned on CarworX, all time"}</p>
          <p class="mn-big">${R(all.v)}</p>
          <p class="t-cap">${plat ? `${all.n.toLocaleString("en-ZA").replace(/,/g, " ")} completed bookings since ${fmtD(START, { day: "numeric", month: "long", year: "numeric" })}. Money goes straight to each business. CarworX fees: R0 during the pilot.` : `${all.n.toLocaleString("en-ZA").replace(/,/g, " ")} completed bookings since ${fmtD(START, { day: "numeric", month: "long", year: "numeric" })}. Paid straight to ${cfg.scope === "one" ? "the business" : "you"} through the payment partner; CarworX never holds it.`}</p></section>
        <div class="mn-filters"><div class="ob-filterbar" role="group" aria-label="Period">${["week", "month", "year", "custom"].map((k) => `<button type="button" class="cx-chip" aria-pressed="${state.p === k}" data-mp="${k}">${words[k]}</button>`).join("")}</div>
          ${state.p === "custom" ? `<div class="ob-scrollrow" role="group" aria-label="Custom period" style="gap:8px;align-items:end"><label class="mn-f">From<input class="ob-input" type="date" data-mfrom value="${state.from}" min="2024-11-12" max="2026-11-12"></label><label class="mn-f">To<input class="ob-input" type="date" data-mto value="${state.to}" min="2024-11-12" max="2026-11-12"></label></div>` : ""}
          <p class="t-cap mn-range">${r ? `${fmtD(r.a, { day: "numeric", month: "short", year: "numeric" })} – ${fmtD(r.b, { day: "numeric", month: "short", year: "numeric" })} · compared with ${esc(r.prev)} (${fmtD(r.pa, { day: "numeric", month: "short" })} – ${fmtD(r.pb, { day: "numeric", month: "short", year: "numeric" })})` : "Pick a start date before the end date."}</p></div>
        <div class="mn-kpis" style="--n:${tiles.length}">${tiles.map(([l, v, d]) => `<section class="mn-tile"><p class="mn-l">${l}</p><p class="mn-v">${v}</p>${d}</section>`).join("")}</div>
        <section class="mn-card"><div class="mn-cardhead"><h3>${plat ? "Booking value" : "Earned"} per ${bk.unit}</h3><button type="button" class="ob-link" data-mtable>${state.table ? "Show as chart" : "Show as table"}</button></div>
          <div class="mn-chart">${state.table ? table(bk) : chart(bk, plat)}</div></section>
        <div class="mn-split">${SPLIT[plat ? "platform" : cfg.scope === "one" ? "one" : "business"].map(([t, parts]) => ranked(t, parts, cur.v, plat)).join("")}</div>`;
      wire();
    }
    function chart({ unit, out }) {
      if (!out.length) return '<p class="t-cap">No completed bookings in this period.</p>';
      // Draw at the card's real width so axis text stays 11 px on phones too.
      const W = Math.max(300, Math.round(el.clientWidth - 36)), H = W < 500 ? 200 : 240, L = 48, B = 26, T = 10;
      const max = Math.max(...out.map((b) => b.v));
      const step = [100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6, 5e6].find((s) => max / s <= 4) || 1e7;
      const top = Math.ceil(max / step) * step;
      const y = (v) => T + (H - T - B) * (1 - v / top);
      const slot = (W - L) / out.length;
      const bw = Math.min(24, slot * 0.6);
      const ticks = [];
      for (let v = 0; v <= top; v += step) ticks.push(`<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="g"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="ax">${Rk(v)}</text>`);
      const lab = (b) => (unit === "month" ? fmtD(b.k, { month: "short" }) : unit === "week" ? fmtD(b.from, { day: "numeric", month: "short" }) : out.length > 10 ? fmtD(b.k, { day: "numeric" }) : fmtD(b.k, { weekday: "short" }));
      const every = Math.ceil(out.length / Math.max(3, Math.floor((W - L) / 46)));
      const bars = out.map((b, i) => {
        const x = L + slot * i + (slot - bw) / 2, yy = y(b.v), h = H - B - yy, r = Math.min(4, h);
        const when = unit === "day" ? fmtD(b.k, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : unit === "week" ? `Week of ${fmtD(b.from, { day: "numeric", month: "short" })}` : fmtD(b.k, { month: "long", year: "numeric" });
        return `<g class="bar" tabindex="0" role="img" aria-label="${when}: ${R(b.v)}, ${b.n} bookings" data-tip="${esc(R(b.v))}|${esc(when)}|${b.n} booking${b.n === 1 ? "" : "s"}" data-x="${x + bw / 2}" data-y="${yy}">
          <rect class="hit" x="${L + slot * i}" y="${T}" width="${slot}" height="${H - B - T}" rx="6"/>
          <path class="col" d="M${x} ${H - B}V${yy + r}q0 -${r} ${r} -${r}h${bw - 2 * r}q${r} 0 ${r} ${r}V${H - B}Z"/>
          ${i % every === 0 ? `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="ax">${lab(b)}</text>` : ""}</g>`;
      }).join("");
      return `<svg viewBox="0 0 ${W} ${H}" data-w="${W}" class="mn-svg" aria-label="${unit === "day" ? "Daily" : unit === "week" ? "Weekly" : "Monthly"} totals. Use Tab to step through the columns, or Show as table.">${ticks.join("")}<line x1="${L}" x2="${W}" y1="${H - B}" y2="${H - B}" class="base"/>${bars}</svg><div class="mn-tip" role="status" hidden></div>`;
    }
    function table({ unit, out }) {
      return `<table class="mn-table"><thead><tr><th>${unit === "day" ? "Day" : unit === "week" ? "Week of" : "Month"}</th><th>Bookings</th><th>Value</th></tr></thead><tbody>${out.map((b) => `<tr><td>${unit === "month" ? fmtD(b.k, { month: "long", year: "numeric" }) : fmtD(b.from, { day: "numeric", month: "short", year: "numeric" })}</td><td>${b.n}</td><td>${R(b.v)}</td></tr>`).join("")}</tbody></table>`;
    }
    function ranked(title, parts, total, plat) {
      const max = Math.max(...parts.map((p) => p[1]));
      return `<section class="mn-card"><h3>${title}</h3><p class="t-cap">${plat && title === "Top businesses" ? "Share of booking value in this period. Open one to see its record." : "Share of this period."}</p><ul class="mn-rank">${parts.map(([n, s, id]) => {
        const name = id ? `<a class="cx-link" href="#business=${id}">${esc(n)}</a>` : esc(n);
        const share = plat && title === "Top businesses" ? s : s;
        return `<li><span class="nm">${name}</span><span class="track"><i style="width:${(s / max) * 100}%"></i></span><span class="val">${R(total * share)}<small>${Math.round(share * 100)}%</small></span></li>`;
      }).join("")}</ul></section>`;
    }
    function wire() {
      el.querySelectorAll("[data-mp]").forEach((b) => (b.onclick = () => { state.p = b.dataset.mp; render(); el.querySelector(`[data-mp="${state.p}"]`).focus(); }));
      el.querySelector("[data-mfrom]")?.addEventListener("change", (e) => { state.from = e.target.value; render(); });
      el.querySelector("[data-mto]")?.addEventListener("change", (e) => { state.to = e.target.value; render(); });
      el.querySelector("[data-mtable]").onclick = () => { state.table = !state.table; render(); };
      const tip = el.querySelector(".mn-tip"), svg = el.querySelector(".mn-svg");
      if (!tip) return;
      const show = (g) => {
        const [v, w, n] = g.dataset.tip.split("|");
        tip.replaceChildren(Object.assign(document.createElement("b"), { textContent: v }), Object.assign(document.createElement("span"), { textContent: w }), Object.assign(document.createElement("small"), { textContent: n }));
        const box = svg.getBoundingClientRect(), k = box.width / +svg.dataset.w;
        tip.hidden = false;
        tip.style.left = Math.min(box.width - 150, Math.max(0, g.dataset.x * k - 70)) + "px";
        tip.style.top = Math.max(0, g.dataset.y * k - 64) + "px";
        el.querySelectorAll(".bar.on").forEach((x) => x.classList.remove("on"));
        g.classList.add("on");
      };
      el.querySelectorAll(".bar").forEach((g) => { g.addEventListener("pointerenter", () => show(g)); g.addEventListener("focus", () => show(g)); });
      svg.addEventListener("pointerleave", () => { tip.hidden = true; el.querySelectorAll(".bar.on").forEach((x) => x.classList.remove("on")); });
    }
    render();
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 150); });
  }
  // At-a-glance figure for dashboards: the value for a preset period and its change.
  function glance(scope, seed, p = "month") {
    const days = series(scope === "platform" ? "platform" : "business", seed);
    const r = range(p);
    const cur = sum(days, r.a, r.b), prev = sum(days, r.pa, r.pb);
    return { value: R(cur.v), delta: delta(cur.v, prev.v, r.prev, true) };
  }
  window.MONEY = { mount, glance };
})();
