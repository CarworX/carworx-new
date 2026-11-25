// Builds the static redesign mockups (A1–A7) from one shared header, menu,
// sheet and footer, so every screen shows the same shell. Run from the repo
// root:  node planning/design/redesign-2026-11/_src/build.mjs
// The turbine sprite, hero objects and fines drawing are cut from the live
// landing markup (apps/web/app/home/preview.html), unchanged.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(ROOT, "../../..");
const markup = readFileSync(join(REPO, "apps/web/app/home/preview.html"), "utf8");

const SPRITE = markup.slice(markup.indexOf("<svg"), markup.indexOf("</svg>") + 6);
const cut = (a, b) => {
  const i = markup.indexOf(a);
  const j = markup.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error("cut " + a);
  return markup.slice(i, j);
};
const FLOATS = cut('<div class="floats"', '<div class="hero-copy">');
const FINES_ILL = cut('<div class="ill" data-reveal data-loop>', "<div>\n        <span class=\"eyebrow\" data-reveal>Fines");

const S = "../_shared";
const ic = (n) => `${S}/icons/carworx-icon-${n}.svg`;
const OBJ = {
  wash: `${S}/objects/carworx-object-wash-detailing.svg`,
  repairs: `${S}/objects/carworx-object-repairs-maintenance.svg`,
  glass: `${S}/objects/carworx-object-glass-repair.svg`,
  tyres: `${S}/objects/carworx-object-tyres-alignment.svg`,
  fines: `${S}/objects/carworx-object-fines-admin.svg`,
};
const ill = (n) => `${S}/ill/carworx-ill-${n}.svg`;
const ARR = `<svg width="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 7h10M8 3l4 4-4 4"/></svg>`;
const CHEV = `<svg class="rd-chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 4.5l3 3 3-3"/></svg>`;
const GLOGO = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.87.92 7.53 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

// Synthetic people and businesses (no real people).
const ME = { name: "Thandi Nkosi", first: "Thandi", ini: "TN", email: "thandi.n@example.co.za" };

// ---------- shell ----------
function header({ signed = false, active = "", scrolled = false, admin = false } = {}) {
  const links = admin
    ? `<a href="#"${active === "reviews" ? "" : ' class="on"'}>ID checks</a><a href="#">Listings</a><a href="#"${active === "reviews" ? ' class="on"' : ""}>Reviews</a>`
    : `<a href="/#services"${active === "services" ? ' class="on"' : ""}>Find a service</a><a href="/#fines"${active === "fines" ? ' class="on"' : ""}>Fines</a><a href="/#business"${active === "business" ? ' class="on"' : ""}>For businesses</a>`;
  const acct = signed
    ? `<div class="acct"><button class="rd-avatar-btn" type="button" aria-haspopup="menu"><span class="rd-av">${admin ? "AM" : ME.ini}</span>${admin ? "Admin" : ME.first}${CHEV}</button></div><span class="rd-av rd-phone-av rd-dot">${admin ? "AM" : ME.ini}</span>`
    : `<div class="acct"><a class="signin" href="/auth/sign-in">Sign in</a><a class="pill" href="/auth/sign-up"><span>Sign up</span><span class="arr" aria-hidden="true">${ARR}</span></a></div>`;
  return `<header class="nav${scrolled ? " rd-scrolled" : ""}">
  <a href="/" class="logo" aria-label="CarworX home"><svg viewBox="0 0 852.35 184" fill="currentColor" role="img" aria-label="CarworX"><use href="#cx-lockup"/></svg></a>
  <nav class="links" aria-label="Main navigation">${links}</nav>
  ${acct}
  <button class="menu-btn" type="button" aria-expanded="false" aria-label="Open menu"><i></i><i></i></button>
</header>`;
}
function avatarMenu(admin = false) {
  if (admin)
    return `<div class="rd-menu" role="menu"><div class="who"><span class="rd-av">AM</span><div><b>Amahle M.</b><small>Verification team</small></div></div>
<a href="#" class="hl"><img src="${ic("shield")}" alt="">ID checks<span class="cnt">6</span></a><a href="#"><img src="${ic("user")}" alt="">Account</a><div class="sep"></div><a href="#" class="out"><img src="${ic("back")}" alt="">Sign out</a></div>`;
  return `<div class="rd-menu" role="menu">
  <div class="who"><span class="rd-av">${ME.ini}</span><div><b>${ME.name}</b><small>${ME.email}</small></div></div>
  <a href="/fines/mine" class="hl"><img src="${OBJ.fines}" alt="">My fines<span class="cnt">3</span></a>
  <a href="/account"><img src="${ic("user")}" alt="">Account</a>
  <a href="/provider"><img src="${ic("bay")}" alt="">My business</a>
  <div class="sep"></div>
  <a href="/auth/sign-out" class="out"><img src="${ic("back")}" alt="">Sign out</a>
</div>`;
}
function sheet(signed) {
  const row = (t, h = "#") => `<a href="${h}">${t}${ARR}</a>`;
  const who = signed
    ? `<div class="rd-sheet-who"><span class="rd-av">${ME.ini}</span><div><b>${ME.name}</b><small>${ME.email}</small></div></div>`
    : "";
  const acts = signed
    ? `<div class="acts"><a class="pill light" href="/fines/mine"><span>My fines · 3</span><span class="arr" aria-hidden="true">${ARR}</span></a><div class="acct-row"><a class="pill light" href="/account"><span>Account</span></a><a class="pill light" href="/provider"><span>My business</span></a></div><a class="pill rd-out" href="/auth/sign-out"><span>Sign out</span></a></div>`
    : `<div class="acts"><div class="acct-row"><a class="pill light" href="/auth/sign-in"><span>Sign in</span></a><a class="pill" href="/auth/sign-up"><span>Sign up</span></a></div><a class="pill light" href="/provider/get-listed/business"><span>List your business</span><span class="arr" aria-hidden="true">${ARR}</span></a></div>`;
  return `<div class="scrim" aria-hidden="true"></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label="Menu">${who}
  <nav aria-label="Main navigation">${row("Find a service", "/#services")}${row("Fines", "/#fines")}${row("For businesses", "/#business")}</nav>
  ${acts}
</div>`;
}
const FOOTER = `<footer>
  <div class="wrap">
    <svg class="flk" viewBox="0 0 852.35 184" fill="currentColor" role="img" aria-label="CarworX"><use href="#cx-lockup"/></svg>
    <nav class="rd-foot-links" aria-label="Footer"><a href="/#services">Find a service</a><a href="/#fines">Fines</a><a href="/#business">For businesses</a><a href="/provider/get-listed/business">List your business</a><a href="/support">Contact support</a></nav>
    <div class="fine"><span>carworx.app · South Africa</span><span><a href="/support">Contact support</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms of use</a></span></div>
  </div>
</footer>`;

function page(file, title, body, opts = {}) {
  const { signed = false, active = "", menu = false, sheetOpen = false, scrolled = false, admin = false, noFooter = false, landing = false } = opts;
  const cls = ["cx-home", "cx-landing", signed ? "rd-signed" : "", sheetOpen ? "rd-sheet-open" : ""].join(" ");
  const html = `<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · CarworX redesign 2026-11</title>
<link rel="stylesheet" href="${S}/home.css">
<link rel="stylesheet" href="${S}/landing.css">
<link rel="stylesheet" href="${S}/redesign.css">
</head>
<body>
${SPRITE}
<div class="${cls}">
${header({ signed, active, scrolled, admin })}
${sheet(signed)}
${menu ? avatarMenu(admin) : ""}
<main id="top"${landing ? "" : ' class="rd-page"'}>
${body}
</main>
${noFooter ? "" : FOOTER}
</div>
</body>
</html>
`;
  const out = join(ROOT, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  MANIFEST.push({ file, title, sheetOpen, menu });
}
const MANIFEST = [];

// ---------- shared content blocks ----------
const CATS = [
  ["wash", "Wash & Detailing", "wash-detailing", 18],
  ["repairs", "Repairs & Maintenance", "repairs-maintenance", 24],
  ["glass", "Glass Repair & Replacement", "glass-repair", 9],
  ["tyres", "Tyres & Wheel Alignment", "tyres-alignment", 14],
];
const BIZ = [
  { n: "Shine Studio", k: "wash", w: "Rosebank, Johannesburg", d: "1.2 km", r: "4.8", rc: 126, svc: "Hand wash · Valet · Interior detail", tag: "Verified", mob: false, cv: "cv-a", open: "Open until 18:00" },
  { n: "Bubbles on Wheels", k: "wash", w: "Comes to you · Johannesburg North", d: "Comes to you", r: "4.7", rc: 88, svc: "Mobile wash · Waterless clean", tag: "Verified", mob: true, cv: "cv-b", open: "Open until 17:00" },
  { n: "Parkhurst Valet Co.", k: "wash", w: "Parkhurst, Johannesburg", d: "2.9 km", r: "4.6", rc: 64, svc: "Full valet · Engine bay clean", tag: "", mob: false, cv: "cv-c", open: "Open until 17:30" },
  { n: "Rosebank Hand Wash", k: "wash", w: "Rosebank, Johannesburg", d: "0.8 km", r: "4.5", rc: 211, svc: "Hand wash · Tyre shine", tag: "Verified", mob: false, cv: "cv-d", open: "Open until 19:00" },
  { n: "Gleam Detailing Lab", k: "wash", w: "Illovo, Johannesburg", d: "3.4 km", r: "4.9", rc: 47, svc: "Paint correction · Ceramic coating", tag: "Verified", mob: false, cv: "cv-e", open: "Opens 08:00 tomorrow" },
  { n: "Sudsy Mobile Valets", k: "wash", w: "Comes to you · Sandton", d: "Comes to you", r: "4.4", rc: 39, svc: "Mobile valet · Upholstery", tag: "", mob: true, cv: "cv-b", open: "Open until 16:30" },
  { n: "Melrose Auto Spa", k: "wash", w: "Melrose, Johannesburg", d: "4.1 km", r: "4.6", rc: 152, svc: "Hand wash · Wax · Interior", tag: "Verified", mob: false, cv: "cv-a", open: "Open until 18:00" },
  { n: "Saxonwold Car Care", k: "wash", w: "Saxonwold, Johannesburg", d: "2.2 km", r: "4.3", rc: 21, svc: "Express wash · Vacuum", tag: "", mob: false, cv: "cv-c", open: "Open until 17:00" },
  { n: "Craighall Detail House", k: "wash", w: "Craighall, Johannesburg", d: "5.0 km", r: "4.8", rc: 73, svc: "Detailing · Headlight restore", tag: "Verified", mob: false, cv: "cv-d", open: "Open until 17:00" },
];
const OTHER = [
  { n: "Kgosi Auto Repairs", k: "repairs", w: "Braamfontein, Johannesburg", d: "3.1 km", r: "4.7", rc: 95, svc: "Service · Brakes · Diagnostics", tag: "Verified", mob: false, cv: "cv-e", open: "Open until 17:00" },
  { n: "ClearView Glass", k: "glass", w: "Comes to you · Johannesburg", d: "Comes to you", r: "4.8", rc: 58, svc: "Chip repair · Windscreens", tag: "Verified", mob: true, cv: "cv-a", open: "Open until 17:00" },
  { n: "TreadRight Tyres", k: "tyres", w: "Randburg, Johannesburg", d: "6.2 km", r: "4.6", rc: 140, svc: "Fitment · Alignment · Balancing", tag: "Verified", mob: false, cv: "cv-b", open: "Open until 17:30" },
  { n: "Mobile Mech Joburg", k: "repairs", w: "Comes to you · Johannesburg", d: "Comes to you", r: "4.5", rc: 33, svc: "Batteries · Call-out repairs", tag: "", mob: true, cv: "cv-c", open: "Open until 18:00" },
];
const bcard = (b) => `<article class="rd-bcard">
  <div class="rd-cover ${b.cv}"><img class="o" src="${OBJ[b.k]}" alt="">${b.tag ? `<span class="rd-lbl ok tag">${b.tag}</span>` : ""}<span class="dist">${b.d}</span></div>
  <div class="rd-bbody"><h3>${b.n}</h3>
    <div class="rd-meta"><span class="st">★ ${b.r}</span><span>(${b.rc})</span><span>·</span><span>${b.w}</span></div>
    <div class="rd-svc">${b.svc}</div>
    <div class="rd-meta"><span class="open">●</span><span>${b.open}</span>${b.mob ? '<span class="rd-lbl plain">Mobile</span>' : ""}</div>
  </div>
</article>`;

// ================= A1 =================
const A1_FILL = `<section class="wrap" style="padding-bottom:24px">
  <span class="rd-crumb">Shared shell · every public page</span>
  <h1 class="rd-h1">One header. One footer.<br><span class="grey">The same on every page.</span></h1>
  <p class="rd-sub">The landing pill, fixed at the top, aware of whether you are signed in. Below it, any page: the landing, a category, sign in, fines.</p>
  <div class="lp-sec" style="padding-top:28px"><ul class="lp-cats">${CATS.map(([k, l], i) => `<li><a class="lp-cat" href="#"><small>0${i + 1}</small><img src="${OBJ[k]}" alt="" width="46" height="46"><h3>${l}</h3><p>See businesses</p></a></li>`).join("")}<li><a class="lp-cat" href="#"><small>05</small><img src="${OBJ.fines}" alt="" width="46" height="46"><h3>Fines &amp; Vehicle Admin</h3><p>Check and pay</p></a></li></ul></div>
</section>`;
page("A1-shell/a1-1-signed-out.html", "Header signed out", A1_FILL);
page("A1-shell/a1-2-signed-in-menu.html", "Header signed in, avatar menu open", A1_FILL, { signed: true, menu: true });
page("A1-shell/a1-3-mobile-sheet-signed-out.html", "Mobile sheet, signed out", A1_FILL, { sheetOpen: true });
page("A1-shell/a1-4-mobile-sheet-signed-in.html", "Mobile sheet, signed in", A1_FILL, { signed: true, sheetOpen: true });
page(
  "A1-shell/a1-5-scrolled.html",
  "Scrolled, pinned pill",
  `<section class="wrap" style="margin-top:-24px"><div class="rd-grid">${BIZ.slice(0, 6).map(bcard).join("")}</div></section>`,
  { signed: true, scrolled: true, active: "services" },
);

// ================= A2 =================
const HERO = (badge) => `<section class="hero" aria-labelledby="h-hero">
  ${FLOATS}
  <div class="hero-copy">
    <span class="badge"><i></i>${badge}</span>
    <h1 id="h-hero"><span class="ln"><span>Car care, booked properly.</span></span><span class="ln grey"><span>Nearby, and in writing.</span></span></h1>
    <p class="sub"><span class="lp-long">Washes, repairs, glass and tyres from businesses near you. </span>Look around freely. You pay the business directly.</p>
    <div>
      <form class="lp-search" role="search">
        <label class="lp-fld"><b>What do you need?</b><input placeholder="Service or business name, e.g. “tyre fitment”"></label>
        <div class="lp-fld lp-where"><label><b>Where?</b></label><input placeholder="Street address, suburb or town"></div>
        <div class="lp-loc"><div class="bar"><button class="btn" type="button">Use my location</button></div></div>
        <button class="lp-go" type="button">Search <span class="lp-arrow">→</span></button>
      </form>
      <p class="lp-free"><span><em>✓ Free to browse</em> · no account needed</span><span>🔒 Sign in only to send an enquiry</span></p>
    </div>
  </div>
</section>`;
const SERVICES_SEC = `<section class="lp-sec" id="services" aria-labelledby="h-cats">
  <div class="wrap">
    <div class="lp-head"><div><span class="lp-eyebrow">Find a service</span><h2 id="h-cats">What does your car need?</h2></div></div>
    <ul class="lp-cats">${CATS.map(([k, l, s, n], i) => `<li><a class="lp-cat" href="/c/${s}"><small>0${i + 1}</small><img src="${OBJ[k]}" alt="" width="46" height="46"><h3>${l}</h3><p>${n} businesses</p></a></li>`).join("")}<li><a class="lp-cat" href="#fines"><small>05</small><img src="${OBJ.fines}" alt="" width="46" height="46"><h3>Fines &amp; Vehicle Admin</h3><p>Check and pay fines</p></a></li></ul>
  </div>
</section>
<section class="lp-sec" aria-labelledby="h-biz-list">
  <div class="wrap">
    <div class="lp-head"><div><span class="lp-eyebrow">On CarworX now</span><h2 id="h-biz-list">Businesses you can explore</h2></div><a href="/search">See all 65 →</a></div>
    <nav class="lp-chips"><a class="lp-chip on">All</a><a class="lp-chip">Wash</a><a class="lp-chip">Repairs</a><a class="lp-chip">Glass</a><a class="lp-chip">Tyres</a><a class="lp-chip">Comes to you</a></nav>
    <div class="rd-grid">${[BIZ[0], OTHER[0], OTHER[1], BIZ[1], OTHER[2], BIZ[4]].map(bcard).join("")}</div>
  </div>
</section>
<section class="lp-sec" aria-labelledby="h-how-lp">
  <div class="wrap">
    <div class="lp-head"><div><span class="lp-eyebrow">How it works</span><h2 id="h-how-lp">Look first. Sign up when you're ready.</h2></div></div>
    <ol class="lp-how"><li><span class="lp-n">01</span><h3>Explore</h3><p>Search, compare businesses, services, hours and checks.</p><span class="lp-badge open">No account needed</span></li><li><span class="lp-n">02</span><h3>Create a free account</h3><p>Takes under a minute. We keep your search and the business you picked.</p><span class="lp-badge">When you're ready</span></li><li><span class="lp-n">03</span><h3>Send an enquiry</h3><p>The business replies to you directly. You pay them directly.</p><span class="lp-badge">Signed in</span></li></ol>
  </div>
</section>`;
const fineSteps = `<ol class="rd-fsteps">
  <li><span class="ic"><img src="${ic("shield")}" alt=""></span><div><b>1 · Confirm it's you, once</b><small>Photograph your ID and take a quick selfie on our verification partner's secure screen. Usually done in under a minute.</small></div></li>
  <li><span class="ic"><img src="${ic("doc")}" alt=""></span><div><b>2 · See every fine on your ID</b><small>Amount, issuer, due date and any discount, in plain words. No more hunting across municipal sites.</small></div></li>
  <li><span class="ic"><img src="${ic("lock")}" alt=""></span><div><b>3 · Pay securely, get a receipt</b><small>You pay on our payment partner's secure checkout. We show "Paid" only once the issuer confirms it.</small></div></li>
</ol>`;
const FINES_OUT = `<section class="sec" id="fines" aria-labelledby="h-fines" style="padding-top:64px">
  <div class="wrap fines">
    ${FINES_ILL}
    <div>
      <span class="eyebrow">Fines &amp; Vehicle Admin</span>
      <h2 class="h2" id="h-fines"><span class="ln"><span>A fine on the&nbsp;windscreen?</span></span><span class="ln grey"><span>Check it and pay it here.</span></span></h2>
      <p class="lede">See the traffic fines linked to your ID number and pay them in one place, with a receipt you can keep.</p>
      ${fineSteps}
      <div class="rd-cta-row"><a class="pill" href="/auth/sign-in?next=/fines/mine"><span>Sign in to see your fines</span><span class="arr">${ARR}</span></a><small>Free to check. You pay only the fine.</small></div>
    </div>
  </div>
</section>`;
const FINES_IN = `<section class="sec" id="fines" aria-labelledby="h-fines" style="padding-top:64px">
  <div class="wrap fines">
    <div class="rd-fines-card">
      <div class="rd-row" style="padding:4px 4px 10px"><img src="${OBJ.fines}" alt="" width="40" height="40"><div><b>Your fines</b><br><small style="color:var(--muted)">ID ending 0823 · checked today 08:15</small></div><span class="rd-sp"></span><span class="rd-lbl ok">ID verified</span></div>
      <div class="rd-mini-fine"><div><b>Speeding, 72 in a 60 zone</b><br><small>JMPD · Jan Smuts Ave · 3 Nov 2026</small></div><div class="rd-money"><b>R 500</b><br><small>Discount to 2 Dec</small></div></div>
      <div class="rd-mini-fine"><div><b>Parking in a loading zone</b><br><small>JMPD · Rivonia Rd · 14 Oct 2026</small></div><div class="rd-money"><b>R 250</b><br><small>Due 13 Dec</small></div></div>
      <div class="rd-mini-fine"><div><b>Red light camera</b><br><small>Tshwane Metro Police · 28 Sep 2026</small></div><div class="rd-money"><b>R 1 500</b><br><small>Due 27 Dec</small></div></div>
    </div>
    <div>
      <span class="eyebrow">Fines &amp; Vehicle Admin</span>
      <h2 class="h2" id="h-fines"><span class="ln"><span>3 fines on your ID.</span></span><span class="ln grey"><span>R 2 250 to settle.</span></span></h2>
      <p class="lede">One has a discount until 2 December. Pay them one at a time on our payment partner's secure checkout.</p>
      <div class="rd-cta-row"><a class="pill" href="/fines/mine"><span>See my fines</span><span class="arr">${ARR}</span></a><small>Last checked today, 08:15 SAST</small></div>
    </div>
  </div>
</section>`;
const DASH = `<div class="dash-wrap">
  <div class="dash-glow"></div>
  <div class="dash" role="region" aria-label="Business dashboard for Shine Studio: listings, enquiries, team and setup">
    <div class="dbar">
      <div class="who"><span class="av">SS</span><div><b>Shine Studio</b><small>Your business · Owner</small></div></div>
      <div class="ptabs"><button aria-selected="true">Overview</button><button aria-selected="false">Enquiries</button><button aria-selected="false">Team</button></div>
    </div>
    <div class="rd-dgrid">
      <div class="rd-stack">
        <div class="rd-panel"><h4>Listings<span class="rd-sp"></span><span>2</span></h4>
          <div class="rd-lst"><img src="${OBJ.wash}" alt=""><div><b>Shine Studio Rosebank</b><small>Customers visit your workshop</small></div><span class="rd-lbl ok">Live</span></div>
          <div class="rd-lst"><img src="${OBJ.wash}" alt=""><div><b>Shine Studio Mobile</b><small>You go to customers · base stays private</small></div><span class="rd-lbl warn">In review</span></div>
        </div>
        <div class="rd-panel"><h4>Enquiries<span class="rd-sp"></span><span>3 new</span></h4>
          <div class="rd-enq"><div class="top"><span class="rd-av sm">LM</span><b>Lerato M.</b><small>Today 09:42</small></div><p>Interior detail for a 7-seater on Saturday morning?</p></div>
          <div class="rd-enq"><div class="top"><span class="rd-av sm coral">SK</span><b>Sipho K.</b><small>Yesterday 16:05</small></div><p>Do you do headlight restoration? Two cloudy lenses.</p></div>
          <div class="rd-enq"><div class="top"><span class="rd-av sm amber">AV</span><b>Anika V.</b><small>Mon 11:20</small></div><p>Price for a full valet on a bakkie, please.</p></div>
        </div>
      </div>
      <div class="rd-stack">
        <div class="rd-panel"><h4>Finish setup<span class="rd-sp"></span><span>3 of 5</span></h4>
          <div class="rd-prog"><i style="width:60%"></i></div>
          <div class="rd-task done"><span class="tk"></span><span>Business details</span><span></span></div>
          <div class="rd-task done"><span class="tk"></span><span>Opening hours</span><span></span></div>
          <div class="rd-task done"><span class="tk"></span><span>Invite your team</span><span></span></div>
          <div class="rd-task"><span class="tk"></span><b>Cover photo</b><span class="rd-link">Add →</span></div>
          <div class="rd-task"><span class="tk"></span><b>Who gets the booking</b><span class="rd-link">Set →</span></div>
        </div>
        <div class="rd-panel"><h4>People with access<span class="rd-sp"></span><span>3</span></h4>
          <div class="rd-row"><div class="rd-team"><span class="rd-av">NB</span><span class="rd-av coral">KD</span><span class="rd-av amber">PM</span></div><small style="color:var(--muted);font-size:13px">Nomsa (owner) · Kabelo (manager) · Pieter (staff)</small></div>
        </div>
      </div>
    </div>
  </div>
</div>`;
const BUSINESS = `<section class="sec" id="business" aria-labelledby="h-biz">
  <div class="wrap">
    <div class="biz-head">
      <div>
        <span class="eyebrow">For businesses</span>
        <h2 class="h2" id="h-biz"><span class="ln"><span>Free to list.</span></span><span class="ln grey"><span>Paid directly.</span></span></h2>
        <p class="lede">Washes, workshops, glass fitters, tyre shops and mobile teams. Customers find you and send enquiries, and every payment goes straight to you.</p>
      </div>
      <ul class="perks"><li>Free to list</li><li>Checked by our team</li><li>Enquiries to your inbox</li><li>Add your team</li></ul>
    </div>
    ${DASH}
    <div class="biz-cta"><a class="pill" href="/provider/get-listed/business"><span>List your business free</span><span class="arr">${ARR}</span></a><small>Free to list. Our team checks every business before it goes live.</small></div>
  </div>
</section>`;
page("A2-landing/a2-1-landing-signed-out.html", "Landing, signed out", HERO("Free to browse · Free to list") + SERVICES_SEC + FINES_OUT + BUSINESS, { landing: true });
page("A2-landing/a2-2-fines-section-signed-in.html", "Landing fines section, signed in", `<div style="height:40px"></div>` + FINES_IN, { landing: true, signed: true, active: "fines" });
page("A2-landing/a2-3-for-businesses.html", "For businesses with the redrawn dashboard", `<div style="height:56px"></div>` + BUSINESS, { landing: true, active: "business" });

// ================= A3 =================
const catHero = (where) => `<section class="wrap">
  <div class="rd-crumb"><a href="/">Home</a><span>/</span><a href="/#services">Find a service</a><span>/</span><span>Wash &amp; Detailing</span></div>
  <div class="rd-cat-hero">
    <div class="rd-cat-obj"><img src="${OBJ.wash}" alt=""></div>
    <div><h1 class="rd-h1">Wash &amp; Detailing</h1><p class="rd-sub" style="margin-top:8px">Hand washes, valets, detailing and mobile teams that come to you.</p></div>
    <span class="rd-chip big"><img src="${ic("pin")}" alt="">${where}<span class="ch">Change</span></span>
  </div>
</section>`;
const catBar = (n) => `<div class="rd-toolbar"><a class="lp-chip on">All</a><a class="lp-chip">Hand wash</a><a class="lp-chip">Valet</a><a class="lp-chip">Detailing</a><a class="lp-chip">Comes to you</a><a class="lp-chip">Open now</a><span class="cnt">${n}</span></div>`;
page(
  "A3-category/a3-1-category.html",
  "Category: Wash & Detailing",
  `${catHero("Rosebank, Johannesburg")}<section class="wrap">${catBar("18 businesses · nearest first")}<div class="rd-grid">${BIZ.map(bcard).join("")}</div><p class="lp-note" style="text-align:center;margin-top:28px"><a class="rd-btn light" href="#">Show 9 more</a></p></section>`,
  { signed: false, active: "services" },
);
page(
  "A3-category/a3-2-category-empty.html",
  "Category: empty for this area",
  `${catHero("Polokwane, Limpopo")}<section class="wrap">${catBar("0 businesses within 25 km")}<div class="rd-empty"><img src="${ill("nothing")}" alt=""><h2>No wash businesses near Polokwane yet.</h2><p>We're adding businesses every week. Try a wider area, or look at a nearby town.</p><div class="rd-row"><a class="rd-btn" href="#">Search within 100 km</a><a class="rd-btn light" href="#">Change location</a></div></div></section>`,
  { signed: false, active: "services" },
);

// ================= A4 =================
const rail = (list) => `<div class="rd-rail">${list.map(bcard).join("")}</div>`;
const iconRow = `<div class="rd-icons">${[["wash", "Wash"], ["repairs", "Repairs"], ["glass", "Glass"], ["tyres", "Tyres"], ["fines", "Fines"]].map(([k, l]) => `<a class="rd-ico" href="#"><span class="k"><img src="${OBJ[k]}" alt=""></span>${l}</a>`).join("")}</div>`;
const homeTop = (chip) => `<div class="rd-home-top">${chip}</div>
  <h1 class="rd-hello">Good morning, ${ME.first}.<br><span class="rd-grey">What does your car need?</span></h1>
  <div class="rd-search"><img src="${ic("search")}" alt="">Search washes, repairs, tyres or a business<span class="go">Search</span></div>
  ${iconRow}`;
page(
  "A4-customer-home/a4-1-home.html",
  "Customer home, signed in",
  `<section class="wrap">
  ${homeTop(`<span class="rd-chip big"><img src="${ic("pin")}" alt="">Rosebank, Johannesburg ${CHEV}</span>`)}
  <div class="rd-rowhead"><div><h2>Near you</h2><small>Within 5 km of Rosebank</small></div><a class="rd-link" href="#">See all →</a></div>
  ${rail([BIZ[3], BIZ[0], OTHER[0], BIZ[2], BIZ[4]])}
  <div class="rd-finecard"><img class="o" src="${OBJ.fines}" alt=""><div><h3>3 fines on your ID · R 2 250</h3><p>One has a discount until 2 December. Checked today, 08:15 SAST.</p></div><a class="rd-btn" href="#">See my fines <span class="arr">${ARR}</span></a></div>
  <div class="rd-rowhead"><div><h2>Comes to you</h2><small>Mobile teams that work at your home or office</small></div><a class="rd-link" href="#">See all →</a></div>
  ${rail([BIZ[1], OTHER[1], OTHER[3], BIZ[5]])}
  <div class="rd-rowhead"><div><h2>Recently viewed</h2></div><a class="rd-link" href="#">Clear</a></div>
  <div class="rd-recent">
    <a class="rd-rcard" href="#"><span class="t cv-e"><img src="${OBJ.tyres}" alt=""></span><div><b>TreadRight Tyres</b><small>Randburg · ★ 4.6 · viewed yesterday</small></div></a>
    <a class="rd-rcard" href="#"><span class="t cv-a"><img src="${OBJ.glass}" alt=""></span><div><b>ClearView Glass</b><small>Comes to you · ★ 4.8 · viewed Mon</small></div></a>
    <a class="rd-rcard" href="#"><span class="t cv-c"><img src="${OBJ.repairs}" alt=""></span><div><b>Kgosi Auto Repairs</b><small>Braamfontein · ★ 4.7 · viewed 18 Nov</small></div></a>
  </div>
</section>`,
  { signed: true },
);
page(
  "A4-customer-home/a4-2-home-no-location.html",
  "Customer home, no location set",
  `<section class="wrap">
  ${homeTop(`<span class="rd-chip big"><img src="${ic("pin")}" alt=""><span style="color:var(--muted)">Set your location</span> ${CHEV}</span>`)}
  <div class="rd-locprompt"><div><h2>Where should we look?</h2><p>Add a suburb or use your location to see businesses near you and the ones that come to you. We don't save your exact location.</p></div><div class="rd-row"><a class="rd-btn" href="#"><img src="${ic("pin")}" alt="" style="width:18px;filter:invert(1)">Use my location</a><a class="rd-btn light" href="#">Type a suburb</a></div></div>
  <div class="rd-rowhead"><div><h2>Near you</h2><small>Set a location to fill this row</small></div></div>
  <div class="rd-rail"><div class="rd-ghost"></div><div class="rd-ghost"></div><div class="rd-ghost"></div><div class="rd-ghost"></div></div>
  <div class="rd-finecard"><img class="o" src="${OBJ.fines}" alt=""><div><h3>Check your traffic fines</h3><p>Confirm your ID once, then see and pay fines here.</p></div><a class="rd-btn light" href="#">Get started</a></div>
</section>`,
  { signed: true },
);

// ================= A5 =================
const authSide = (h, grey) => `<div class="rd-auth-side"><span class="rd-crumb">CarworX account</span><h1>${h}<br><span class="rd-grey">${grey}</span></h1>
  <ul><li><img src="${ic("search")}" alt="">Browse freely, no account needed</li><li><img src="${ic("bell")}" alt="">Send enquiries and get replies by email</li><li><img src="${ic("shield")}" alt="">Check and pay your traffic fines</li><li><img src="${ic("bay")}" alt="">List your business for free</li></ul></div>`;
const signUpCard = (ticked) => `<div class="rd-auth-card">
  <div class="rd-tabs"><span>Sign in</span><span class="on">Sign up</span></div>
  <h2>Create your account</h2>
  <div class="rd-field"><label>Full name</label><div class="rd-input">${ticked ? "Thandi Nkosi" : '<span class="ph">e.g. Thandi Nkosi</span>'}</div></div>
  <div class="rd-field"><label>Email</label><div class="rd-input">${ticked ? ME.email : '<span class="ph">you@example.co.za</span>'}</div></div>
  <div class="rd-field"><label>Password</label><div class="rd-input">${ticked ? "••••••••••••" : '<span class="ph">At least 10 characters</span>'}</div></div>
  <div class="rd-check${ticked ? " on" : ""}"><span class="box"></span><span>I agree to the <a href="/terms">Terms of use</a> and have read the <a href="/privacy">Privacy notice</a>.</span></div>
  <button class="rd-btn full${ticked ? "" : " is-disabled"}" ${ticked ? "" : "disabled"}>Create account</button>
  <div class="rd-or">or</div>
  <button class="rd-google${ticked ? "" : " is-disabled"}">${GLOGO}<span>Sign up with Google</span></button>
  ${ticked ? "" : '<p class="rd-hint">Tick the box above to continue.</p>'}
  <p class="alt">Already have an account? <a href="#">Sign in</a></p>
</div>`;
page("A5-auth/a5-1-sign-up-unticked.html", "Sign up, consent not ticked", `<div class="rd-auth">${authSide("Make it yours.", "Free, in under a minute.")}${signUpCard(false)}</div>`);
page("A5-auth/a5-2-sign-up-ticked.html", "Sign up, consent ticked", `<div class="rd-auth">${authSide("Make it yours.", "Free, in under a minute.")}${signUpCard(true)}</div>`);
page(
  "A5-auth/a5-3-sign-in.html",
  "Sign in",
  `<div class="rd-auth">${authSide("Welcome back.", "Pick up where you left off.")}<div class="rd-auth-card">
  <div class="rd-tabs"><span class="on">Sign in</span><span>Sign up</span></div>
  <h2>Sign in</h2>
  <button class="rd-google">${GLOGO}<span>Sign in with Google</span></button>
  <div class="rd-or">or with email</div>
  <div class="rd-field"><label>Email</label><div class="rd-input">${ME.email}</div></div>
  <div class="rd-field"><label>Password</label><div class="rd-input focus">••••••••••••</div><small><a class="rd-link" href="#">Forgot your password?</a></small></div>
  <button class="rd-btn full">Sign in</button>
  <p class="alt">New to CarworX? <a href="#">Create an account</a></p>
</div></div>`,
);
page(
  "A5-auth/a5-4-google-first-time-consent.html",
  "Google first-time consent step",
  `<div class="rd-auth">${authSide("One more step.", "Then you're in.")}<div class="rd-auth-card">
  <span class="rd-crumb">Step 2 of 2</span>
  <h2>Create your CarworX account</h2>
  <p style="margin:0;color:var(--muted);font-size:15px">This Google account is new to CarworX. Agree to the terms to finish.</p>
  <div class="rd-gacct">${GLOGO.replace("<svg", '<svg style="width:28px;height:28px;flex:none"')}<div><b>Thandi Nkosi</b><small>${ME.email.replace("example.co.za", "example.com")}</small></div></div>
  <div class="rd-check on"><span class="box"></span><span>I agree to the <a href="/terms">Terms of use</a> and have read the <a href="/privacy">Privacy notice</a>.</span></div>
  <button class="rd-btn full">Create account <span class="arr">${ARR}</span></button>
  <a class="rd-btn full light" href="#">Cancel, don't create an account</a>
  <p class="rd-hint">We use your name and email from Google. Nothing is posted to your Google account.</p>
</div></div>`,
);

// ================= A6 =================
const fineHead = (crumb, h, grey, sub = "") => `<div class="rd-crumb"><a href="/">Home</a><span>/</span><a href="#">Fines</a>${crumb ? `<span>/</span><span>${crumb}</span>` : ""}</div>
<h1 class="rd-h1">${h}${grey ? `<br><span class="grey">${grey}</span>` : ""}</h1>${sub ? `<p class="rd-sub">${sub}</p>` : ""}`;
const ID_SVG = (w = 88) => `<svg viewBox="0 0 340 214" width="${w}" style="display:block;width:100%;height:auto"><rect width="340" height="214" rx="16" fill="#e8efe6"/><rect x="0" y="0" width="340" height="44" rx="16" fill="#2f6b4f"/><rect y="28" width="340" height="16" fill="#2f6b4f"/><text x="18" y="29" font-family="Geist, sans-serif" font-size="14" font-weight="600" fill="#fff">REPUBLIC OF SOUTH AFRICA · IDENTITY CARD</text><rect x="18" y="60" width="96" height="124" rx="8" fill="#c9d6cc"/><circle cx="66" cy="104" r="22" fill="#9fb3a6"/><path d="M30 176c6-26 22-38 36-38s30 12 36 38z" fill="#9fb3a6"/><g font-family="Geist Mono, monospace" font-size="11" fill="#33453a"><text x="132" y="74">SURNAME</text><text x="132" y="118">NAMES</text><text x="132" y="162">IDENTITY NUMBER</text></g><g font-family="Geist, sans-serif" font-size="16" font-weight="600" fill="#0d0f12"><text x="132" y="94">NKOSI</text><text x="132" y="138">THANDI ZANELE</text><text x="132" y="182" font-family="Geist Mono, monospace" letter-spacing="1">••••••••• 0823</text></g></svg>`;
const statusPage = (file, title, img, h, grey, body, crumb = "Verify your ID") =>
  page(file, title, `<section class="rd-narrow">${fineHead(crumb, "", "")}<div class="rd-card" style="margin-top:20px"><div class="rd-status"><img src="${ill(img)}" alt=""><div><h2 class="rd-h2" style="font-size:28px">${h}</h2><p class="rd-sub" style="margin-top:6px">${grey}</p></div></div>${body}</div></section>`, { signed: true, active: "fines" });
const DOCS = `<div class="rd-docs"><span><img src="${ic("doc")}" alt="">Smart ID card</span><span><img src="${ic("doc")}" alt="">Green ID book</span><span><img src="${ic("car")}" alt="">Driver's licence</span></div>`;
page(
  "A6-fines/a6-1-verify-intro.html",
  "Fines: verify your ID, intro",
  `<section class="rd-narrow">${fineHead("Verify your ID", "Confirm it's you.", "Once, then your fines show here.")}
  <div class="rd-card rd-stack" style="margin-top:28px">
    <p style="margin:0;font-size:16px">Traffic fines are linked to your ID number, so we need to know it's really you before we show them. It takes about two minutes on your phone.</p>
    <ol class="rd-steps" style="margin-top:8px">
      <li><span class="n">1</span><div><b>Photograph your ID</b><small>Front of your smart ID card, the photo page of your green ID book, or your driver's licence card.</small></div></li>
      <li><span class="n">2</span><div><b>Take a quick selfie</b><small>A short video check that you're a real person, matched to the photo on your ID.</small></div></li>
      <li><span class="n">3</span><div><b>Come back here</b><small>Most checks finish in under a minute. Your fines appear straight after.</small></div></li>
    </ol>
    ${DOCS}
    <div class="rd-note"><img src="${ic("lock")}" alt=""><div><b>Your photos stay with our verification partner</b>Both steps happen on the secure screen of Didit, our verification partner. Didit checks the document, that you're really there, and that your face matches.
      <ul><li>CarworX never receives or stores your ID photo or selfie.</li><li>We keep only the result (verified or not) and the last 4 digits of your ID number.</li><li>Used only to find and pay your fines. Never shown to businesses.</li></ul></div></div>
    <div class="rd-check on"><span class="box"></span><span>I agree that Didit may check my ID and selfie for CarworX, and that CarworX may use the result to look up my traffic fines. <a href="/privacy">Privacy notice</a></span></div>
    <a class="rd-btn full" href="#">Start verification <span class="arr">${ARR}</span></a>
    <p class="rd-hint" style="margin:0">Opens Didit's secure screen. On a computer, you can scan a code to continue on your phone.</p>
  </div>
</section>`,
  { signed: true, active: "fines" },
);
page(
  "A6-fines/a6-2-checking.html",
  "Fines: back from Didit, checking",
  `<section class="rd-narrow">${fineHead("Verify your ID", "", "")}
  <div class="rd-card" style="margin-top:20px;text-align:center;padding:48px 28px">
    <div class="rd-spin"><svg viewBox="0 0 200 200" width="64" fill="currentColor"><g transform="translate(100,100) rotate(21.9494)"><use href="#cx-rotor"/></g></svg></div>
    <h2 class="rd-h2" style="font-size:28px;margin-top:22px">Checking…</h2>
    <p class="rd-sub" style="margin:8px auto 0">Thanks, Thandi. This usually takes under a minute. You can leave this page; we'll email you when it's done.</p>
    <ol class="rd-steps rd-steps-left" style="margin:28px auto 0;max-width:360px;text-align:left"><li class="done"><span class="n">✓</span><div><b>ID photographed</b><small>Today, 14:31 SAST</small></div></li><li class="done"><span class="n">✓</span><div><b>Selfie taken</b><small>Today, 14:32 SAST</small></div></li><li class="now"><span class="n">3</span><div><b>Didit is checking</b><small>Document, liveness and face match</small></div></li></ol>
  </div>
</section>`,
  { signed: true, active: "fines" },
);
statusPage(
  "A6-fines/a6-3-approved.html",
  "Fines: verified",
  "sent",
  "You're verified.",
  "Your ID ending 0823 is confirmed. We're looking up your fines now.",
  `<div class="rd-note ok" style="margin-top:24px"><img src="${ic("check")}" alt=""><div><b>Done once, for good</b>You won't need to do this again unless you change your ID number.</div></div>
  <div class="rd-row" style="margin-top:20px"><a class="rd-btn" href="#">See my fines <span class="arr">${ARR}</span></a></div>`,
);
statusPage(
  "A6-fines/a6-4-declined-retry.html",
  "Fines: declined with reason, retry",
  "error",
  "We couldn't confirm your ID.",
  "Nothing is wrong with your account. It usually works on the next try.",
  `<div class="rd-note err" style="margin-top:24px"><img src="${ic("alert")}" alt=""><div><b>Why</b>The photo of your ID was too blurry to read. Lay it flat in good light, with all four corners showing, and hold the phone still.</div></div>
  <div class="rd-tries" style="margin-top:18px"><i class="used"></i><i></i><i></i><span>Try 1 of 3 used · 2 left</span></div>
  <div class="rd-row" style="margin-top:20px"><a class="rd-btn" href="#">Try again <span class="arr">${ARR}</span></a><a class="rd-btn light" href="/support">Contact support</a></div>`,
);
statusPage(
  "A6-fines/a6-5-declined-final.html",
  "Fines: declined, no tries left",
  "paused",
  "We couldn't confirm it after 3 tries.",
  "Our team will help you finish it another way.",
  `<div class="rd-note err" style="margin-top:24px"><img src="${ic("alert")}" alt=""><div><b>Last reason</b>The face in the selfie didn't match the photo on the ID.</div></div>
  <div class="rd-tries" style="margin-top:18px"><i class="used"></i><i class="used"></i><i class="used"></i><span>3 of 3 tries used</span></div>
  <p style="font-size:14px;color:var(--muted);margin:14px 0 0">Contact support and we'll check it with you. Reference <span class="mono">VR-2611-0447</span>.</p>
  <div class="rd-row" style="margin-top:20px"><a class="rd-btn" href="/support">Contact support</a><a class="rd-btn light" href="/">Back to home</a></div>`,
);
statusPage(
  "A6-fines/a6-6-in-review.html",
  "Fines: in review by our team",
  "review",
  "A person is checking it.",
  "Didit passed most checks but asked for a second look. Usually within one business day.",
  `<ol class="rd-steps" style="margin-top:24px"><li class="done"><span class="n">✓</span><div><b>Photos taken on Didit</b><small>Today, 14:32 SAST</small></div></li><li class="done"><span class="n">✓</span><div><b>Automatic checks</b><small>One needs a second look</small></div></li><li class="now"><span class="n">3</span><div><b>Our team decides</b><small>We'll email you either way</small></div></li></ol>
  <div class="rd-row" style="margin-top:8px"><a class="rd-btn light" href="/">Back to home</a></div>`,
);
const FINES = [
  { t: "Speeding, 72 km/h in a 60 zone", iss: "JMPD", where: "Jan Smuts Ave, Craighall", date: "3 Nov 2026", amt: "R 500", was: "R 1 000", st: '<span class="rd-lbl blue">50% off to 2 Dec</span>', ref: "AARTO 03 · 02-4417-2290-118" },
  { t: "Parking in a loading zone", iss: "JMPD", where: "Rivonia Rd, Sandton", date: "14 Oct 2026", amt: "R 250", was: "", st: '<span class="rd-lbl warn">Due 13 Dec</span>', ref: "JMPD · 1104-883-21" },
  { t: "Red light camera", iss: "Tshwane Metro Police", where: "Atterbury Rd, Menlyn", date: "28 Sep 2026", amt: "R 1 500", was: "", st: '<span class="rd-lbl warn">Due 27 Dec</span>', ref: "TMPD · 5531-0072-09" },
];
const fineRow = (f, i) => `<a class="rd-fine" href="#"><span class="ic"><img src="${i === 2 ? ic("camera") : i === 1 ? ic("pin") : ic("clock")}" alt=""></span><div><h3>${f.t}</h3><div class="rd-meta"><span>${f.iss}</span><span>·</span><span>${f.where}</span><span>·</span><span>${f.date}</span></div><div class="rd-meta" style="margin-top:8px">${f.st}</div></div><div class="amt rd-money"><b>${f.amt}</b>${f.was ? `<s>${f.was}</s>` : ""}</div></a>`;
const myFinesHead = `${fineHead("", "My fines", "")}<div class="rd-row" style="margin-top:14px"><span class="rd-lbl ok">ID verified · ending 0823</span><small style="color:var(--muted)">Last checked today, 08:15 SAST · <a class="rd-link" href="#">Check again</a></small></div>`;
page(
  "A6-fines/a6-7-my-fines.html",
  "My fines: several",
  `<section class="rd-mid">${myFinesHead}
  <div class="rd-fsum"><div class="rd-stat"><small>To settle</small><span class="num"><sub>R</sub>2 250</span></div><div class="rd-stat"><small>Open fines</small><span class="num">3</span></div><div class="rd-stat"><small>Saving if paid by 2 Dec</small><span class="num"><sub>R</sub>500</span></div></div>
  ${FINES.map(fineRow).join("")}
  <div class="rd-rowhead" style="margin-top:32px"><div><h2 style="font-size:18px">Not payable here</h2><small>These need you to contact the issuer</small></div></div>
  <div class="rd-fine muted"><span class="ic"><img src="${ic("doc")}" alt=""></span><div><h3>Unlicensed vehicle · summons issued</h3><div class="rd-meta"><span>Ekurhuleni MPD</span><span>·</span><span>4 Jun 2026</span></div><div class="rd-meta" style="margin-top:8px"><span class="rd-lbl err">Court date set</span><span>Pay at the court or contact the issuer</span></div></div><div class="amt rd-money"><b>R 1 000</b></div></div>
  <p style="font-size:13px;color:var(--muted);margin-top:24px">Fines come from the issuers' records through our payment partner. If something looks wrong, <a class="rd-link" href="/support">tell us</a>.</p>
</section>`,
  { signed: true, active: "fines" },
);
page(
  "A6-fines/a6-8-my-fines-none.html",
  "My fines: none",
  `<section class="rd-mid">${myFinesHead}
  <div class="rd-empty" style="margin-top:28px"><img src="${ill("sent")}" alt=""><h2>No fines on your ID.</h2><p>Nothing to pay right now. We check again each time you open this page, and we'll email you if a new fine appears.</p><div class="rd-row"><a class="rd-btn light" href="/">Back to home</a></div></div>
</section>`,
  { signed: true, active: "fines" },
);
page(
  "A6-fines/a6-9-my-fines-not-payable.html",
  "My fines: only not-payable fines",
  `<section class="rd-mid">${myFinesHead}
  <div class="rd-note warn" style="margin-top:28px"><img src="${ic("info")}" alt=""><div><b>1 fine, but it can't be paid online.</b>A summons has been issued, so it now goes through the court. Pay at the court or contact the issuer before the court date.</div></div>
  <div class="rd-fine muted" style="margin-top:16px"><span class="ic"><img src="${ic("doc")}" alt=""></span><div><h3>Unlicensed vehicle · summons issued</h3><div class="rd-meta"><span>Ekurhuleni MPD</span><span>·</span><span>Germiston</span><span>·</span><span>4 Jun 2026</span></div><div class="rd-meta" style="margin-top:8px"><span class="rd-lbl err">Court date 15 Jan 2027</span></div></div><div class="amt rd-money"><b>R 1 000</b></div></div>
  <div class="rd-card" style="margin-top:16px"><h3 class="rd-h2" style="font-size:17px">What to do</h3><ol class="rd-steps" style="margin-top:14px"><li><span class="n">1</span><div><b>Call the issuer</b><small>Ekurhuleni MPD fines office · 011 999 0000 · Mon to Fri 08:00 to 15:30</small></div></li><li><span class="n">2</span><div><b>Take the summons to court</b><small>Germiston Magistrate's Court, on or before 15 Jan 2027</small></div></li></ol></div>
</section>`,
  { signed: true, active: "fines" },
);
const fineSide = (btn) => `<div class="rd-card"><span class="rd-crumb">To pay</span><div style="font-size:44px;letter-spacing:-0.03em;font-weight:500;margin-top:4px" class="rd-money">R 500</div><s style="color:var(--muted)">R 1 000</s> <span class="rd-lbl blue">50% off to 2 Dec</span>
  <dl class="rd-kv" style="margin-top:16px"><dt>Fine</dt><dd class="rd-money">R 500.00</dd><dt>Partner fee</dt><dd class="rd-money">R 0.00</dd><dt class="tot">Total</dt><dd class="tot rd-money">R 500.00</dd></dl>
  ${btn}</div>`;
page(
  "A6-fines/a6-10-fine-detail.html",
  "Fine detail",
  `<section class="rd-mid">${fineHead("Speeding", "Speeding, 72 km/h in a 60 zone", "")}
  <div class="rd-row" style="margin-top:12px"><span class="rd-lbl warn">Payable</span><span class="rd-lbl blue">Discount until 2 Dec</span></div>
  <div class="rd-fine-grid" style="margin-top:24px">
    <div class="rd-card"><dl class="rd-kv"><dt>Issuer</dt><dd>Johannesburg Metro Police (JMPD)</dd><dt>Notice number</dt><dd class="mono">02-4417-2290-118</dd><dt>Type</dt><dd>AARTO 03 infringement notice</dd><dt>When</dt><dd>3 Nov 2026, 07:48 SAST</dd><dt>Where</dt><dd>Jan Smuts Ave, Craighall</dd><dt>Vehicle</dt><dd class="mono">FX 12 BC GP</dd><dt>Speed</dt><dd>72 km/h in a 60 km/h zone</dd><dt>Demerit points</dt><dd>1</dd></dl>
      <div class="rd-note plain" style="margin-top:18px"><img src="${ic("info")}" alt=""><div><b>In plain words</b>Pay by 2 December and you pay half. After that it's R 1 000. If you think it's wrong, you can make a representation to the issuer instead of paying.</div></div>
    </div>
    ${fineSide(`<a class="rd-btn full" style="margin-top:20px" href="#">Pay R 500 <span class="arr">${ARR}</span></a><p class="rd-hint" style="margin-top:12px">On our payment partner's secure checkout</p>`)}
  </div>
</section>`,
  { signed: true, active: "fines" },
);
page(
  "A6-fines/a6-11-pay-handoff.html",
  "Pay: handoff to partner checkout",
  `<section class="rd-narrow">${fineHead("Pay", "Pay R 500", "On a secure checkout.")}
  <div class="rd-card rd-stack" style="margin-top:24px">
    <div class="rd-handoff"><div class="end"><span class="b"><svg viewBox="0 0 200 200" width="30" fill="currentColor"><g transform="translate(100,100) rotate(21.9494)"><use href="#cx-rotor"/></g></svg></span>CarworX<small>Your fine</small></div><div class="arrow"><i></i><i></i><i></i></div><div class="end"><span class="b"><img src="${ic("lock")}" alt="" width="26"></span>Payment partner<small>Secure checkout</small></div></div>
    <dl class="rd-kv"><dt>Fine</dt><dd>Speeding · JMPD · 02-4417-2290-118</dd><dt class="tot">Total</dt><dd class="tot rd-money">R 500.00</dd></dl>
    <div class="rd-note"><img src="${ic("shield")}" alt=""><div><b>What happens next</b>
      <ul><li>We open our payment partner's checkout. You pay by card or instant EFT there; CarworX never sees your card.</li><li>When you're done, you come back here.</li><li>We mark the fine "Paid" only once the issuer confirms it, usually within 1 to 3 business days.</li></ul></div></div>
    <a class="rd-btn full" href="#">Continue to secure checkout <span class="arr">${ARR}</span></a>
    <a class="rd-btn full light" href="#">Cancel</a>
  </div>
</section>`,
  { signed: true, active: "fines" },
);
statusPage(
  "A6-fines/a6-12-awaiting-issuer.html",
  "Pay: awaiting issuer confirmation",
  "sent",
  "Payment received. Waiting for JMPD.",
  "Your payment went through. The issuer usually confirms within 1 to 3 business days.",
  `<ol class="rd-steps" style="margin-top:24px"><li class="done"><span class="n">✓</span><div><b>You paid R 500.00</b><small>Today, 10:06 SAST · card ending 4417</small></div></li><li class="done"><span class="n">✓</span><div><b>Payment partner confirmed</b><small>Today, 10:06 SAST · reference PP-8831-2207</small></div></li><li class="now"><span class="n">3</span><div><b>JMPD confirms the fine is settled</b><small>We'll email you and show "Paid" here</small></div></li></ol>
  <div class="rd-note plain"><img src="${ic("info")}" alt=""><div>Keep the partner reference until then. If JMPD hasn't confirmed by 2 Dec, we follow up for you.</div></div>
  <div class="rd-row" style="margin-top:20px"><a class="rd-btn light" href="#">Back to my fines</a></div>`,
  "Payment",
);
page(
  "A6-fines/a6-13-receipt.html",
  "Receipt",
  `<section class="rd-narrow">${fineHead("Receipt", "Paid.", "Here's your receipt.")}
  <div class="rd-receipt" style="margin-top:24px"><span class="stamp">PAID</span>
    <div class="rd-row"><svg viewBox="0 0 852.35 184" width="120" fill="currentColor"><use href="#cx-lockup"/></svg></div>
    <p class="mono" style="font-size:12px;color:var(--muted);margin:16px 0 0">RECEIPT CWX-FN-2026-004173 · 27 NOV 2026, 13:20 SAST</p>
    <dl class="rd-kv" style="margin-top:16px"><dt>Paid by</dt><dd>Thandi Nkosi · ID ending 0823</dd><dt>Fine</dt><dd>Speeding, 72 in a 60 zone</dd><dt>Issuer</dt><dd>JMPD</dd><dt>Notice number</dt><dd class="mono">02-4417-2290-118</dd><dt>Paid</dt><dd>25 Nov 2026, 10:06 SAST</dd><dt>Confirmed by issuer</dt><dd>27 Nov 2026, 13:20 SAST</dd><dt>Partner reference</dt><dd class="mono">PP-8831-2207</dd><dt>Fine amount</dt><dd class="rd-money">R 500.00</dd><dt>Partner fee</dt><dd class="rd-money">R 0.00</dd><dt class="tot">Total paid</dt><dd class="tot rd-money">R 500.00</dd></dl>
  </div>
  <div class="rd-row" style="margin-top:20px"><a class="rd-btn" href="#">Download PDF</a><a class="rd-btn light" href="#">Email it to me</a><span class="rd-sp"></span><a class="rd-link" href="#">Back to my fines →</a></div>
</section>`,
  { signed: true, active: "fines" },
);

// ================= A7 =================
const Q = [
  ["NM", "Nomvula M.", "n.m@example.co.za", "0823", "Smart ID", "Face match below threshold", "Today 08:02", "6 h", true],
  ["JV", "Johan V.", "j.v@example.co.za", "5084", "Driver's licence", "Document may be expired", "Today 09:41", "4 h", false],
  ["AP", "Ayesha P.", "a.p@example.co.za", "1186", "Green ID book", "Possible duplicate account", "Today 11:15", "3 h", false],
  ["SD", "Sizwe D.", "s.d@example.co.za", "7089", "Smart ID", "Name differs from account", "Today 12:30", "1 h", false],
];
const admHead = (tabs) => `<div class="rd-crumb">Admin</div><h1 class="rd-h1">ID checks</h1><p class="rd-sub">Didit approves or declines most people automatically. These are the ones it sent to us for a second look. Oldest first.</p><div class="rd-row" style="margin:22px 0 18px">${tabs}<span class="rd-sp"></span><small style="color:var(--muted)">Target: within 1 business day</small></div>`;
const TABS = (w) => `<div class="rd-adm-tabs"><span class="on">In review <i>${w}</i></span><span>Approved <i>142</i></span><span>Declined <i>11</i></span></div>`;
const av = (k) => (k % 3 === 1 ? " coral" : k % 3 === 2 ? " amber" : "");
page(
  "A7-admin-id-review/a7-1-queue.html",
  "Admin ID review queue (Didit In review)",
  `<section class="wrap">${admHead(TABS(4))}
  <table class="rd-table"><thead><tr><th>Person</th><th>Didit result</th><th>Why it needs a look</th><th>Document</th><th>Waiting</th><th></th></tr></thead><tbody>
  ${Q.map(([i, n, e, l, d, why, , a, late], k) => `<tr${k === 0 ? ' class="hl"' : ""}><td><div class="who"><span class="rd-av sm${av(k)}">${i}</span><div><b>${n}</b><small>${e} · ID ••••${l}</small></div></div></td><td><span class="rd-lbl warn">In review</span></td><td>${why}</td><td>${d}</td><td><span class="rd-age${late ? " late" : ""}">${a}</span></td><td><a class="rd-btn sm${k === 0 ? "" : " light"}" href="#">Review</a></td></tr>`).join("")}
  </tbody></table>
  <div class="rd-mlist">${Q.map(([i, n, , l, d, why, , a, late], k) => `<a class="rd-fine" href="#"><span class="rd-av${av(k)}">${i}</span><div><h3>${n}</h3><div class="rd-meta"><span class="rd-lbl warn">In review</span><span>${why}</span></div><div class="rd-meta"><span>${d} · ID ••••${l}</span><span class="rd-age${late ? " late" : ""}">· waiting ${a}</span></div></div></a>`).join("")}</div>
  <p style="font-size:13px;color:var(--muted);margin-top:18px">CarworX never holds the ID photo or selfie. To see them, open the session in Didit's console (logged there).</p>
</section>`,
  { signed: true, admin: true },
);
const score = (label, val, pct, tone) => `<div class="rd-score"><span>${label}</span><div class="bar"><i class="${tone}" style="width:${pct}%"></i></div><b class="${tone}">${val}</b></div>`;
page(
  "A7-admin-id-review/a7-2-detail.html",
  "Admin ID review detail (Didit result)",
  `<section class="wrap"><div class="rd-crumb"><a href="#">Admin</a><span>/</span><a href="#">ID checks</a><span>/</span><span>Nomvula M.</span></div>
  <div class="rd-row" style="margin-top:12px"><h1 class="rd-h1" style="margin:0">Nomvula M.</h1><span class="rd-lbl warn">In review · 6 h</span><span class="rd-sp"></span><small style="color:var(--muted)">1 of 4 · <a class="rd-link" href="#">Next →</a></small></div>
  <div class="rd-review" style="margin-top:24px">
    <div class="rd-stack">
      <div class="rd-card rd-stack"><div class="rd-row"><h3 class="rd-h2" style="font-size:17px">Didit result</h3><span class="rd-sp"></span><span class="rd-lbl warn">In review</span></div>
        ${score("Document authentic", "Passed", 100, "ok")}
        ${score("Liveness (real person)", "Passed", 100, "ok")}
        ${score("Face match to ID photo", "71%", 71, "warn")}
        ${score("Document readable", "Passed", 100, "ok")}
        <div class="rd-note warn"><img src="${ic("alert")}" alt=""><div><b>Warnings from Didit</b><ul><li>Face match 71%, below the 80% auto-approve line.</li><li>ID photo is about 9 years old (issued 2017).</li></ul></div></div>
        <div class="rd-row"><span class="mono" style="font-size:13px;color:var(--muted)">Session ds_7Hq2…K41 · attempt 1 of 3 · 08:02 SAST</span><span class="rd-sp"></span><a class="rd-btn sm light" href="#">Open session in Didit ↗</a></div>
      </div>
      <div class="rd-note plain"><img src="${ic("lock")}" alt=""><div>Photos and the selfie are only in Didit. Opening the session is logged there with your name.</div></div>
    </div>
    <div class="rd-stack">
      <div class="rd-card rd-stack"><h3 class="rd-h2" style="font-size:17px">What Didit read</h3>
        <dl class="rd-kv"><dt>Name on document</dt><dd>Nomvula Thembi Mahlangu</dd><dt>Account name</dt><dd>Nomvula M. · n.m@example.co.za</dd><dt>Document</dt><dd>Smart ID card</dd><dt>ID number</dt><dd class="mono">••••••••• 0823</dd><dt>Date of birth</dt><dd>Matches the ID number</dd></dl>
      </div>
      <div class="rd-card rd-stack"><h3 class="rd-h2" style="font-size:17px">Decision</h3>
        <a class="rd-btn ok full" href="#">Approve</a>
        <div class="rd-or">or decline with a reason</div>
        <div class="rd-reasons"><div class="rd-radio on"><i></i>Face doesn't match the ID photo</div><div class="rd-radio"><i></i>Document looks altered or not genuine</div><div class="rd-radio"><i></i>Name doesn't match the account</div><div class="rd-radio"><i></i>Other (write a note)</div></div>
        <div class="rd-field"><label>Note to the person (optional)</label><div class="rd-input"><span class="ph">They see this with the reason</span></div></div>
        <a class="rd-btn danger full" href="#">Decline and tell them why</a>
        <p class="rd-hint" style="margin:0">Declining uses one of their 3 tries.</p>
      </div>
    </div>
  </div>
</section>`,
  { signed: true, admin: true },
);
page(
  "A7-admin-id-review/a7-3-empty.html",
  "Admin ID review queue, empty",
  `<section class="wrap">${admHead(TABS(0))}<div class="rd-empty"><img src="${ill("sent")}" alt=""><h2>Nothing waiting for review.</h2><p>Didit is handling everyone automatically right now. Cases it sends for a second look appear here; we email the team if one waits more than 4 hours.</p><div class="rd-row"><a class="rd-btn light" href="#">See approved IDs</a></div></div></section>`,
  { signed: true, admin: true },
);

// ================= A8 =================
const stars = (n, cls = "") => `<span class="rd-stars ${cls}" aria-label="${n} out of 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= Math.floor(n) ? "f" : i - n < 1 ? "h" : ""}"></i>`).join("")}</span>`;
const REV = [
  { i: "LM", n: "Lerato M.", s: 5, d: "18 Nov 2026", svc: "Interior detail", t: "Booked an interior detail for our 7-seater after the kids' holiday. The seats look new and they sent photos before I fetched the car. Ready 30 minutes early.", reply: "Thank you Lerato! Glad the seats came up well. See you before the next holiday.", help: 12 },
  { i: "SK", n: "Sipho K.", s: 4, d: "9 Nov 2026", svc: "Headlight restoration", t: "Both lenses are clear again and the price matched what they said in the message. Took a bit longer than expected on a Saturday.", reply: "", help: 5 },
  { i: "AV", n: "Anika V.", s: 2, d: "27 Oct 2026", svc: "Full valet", t: "Outside was great but there was still sand under the seats. They offered to redo it when I called, so two stars for the fix.", reply: "Sorry about that, Anika. We've changed our checklist so seat rails get vacuumed on every valet. Your redo is on us.", help: 8 },
];
const revCard = (r, k, extra = "") => `<article class="rd-rev"><div class="top"><span class="rd-av${av(k)}">${r.i}</span><div><b>${r.n}</b><small>${r.d}${r.svc ? ` · ${r.svc}` : ""}</small></div><span class="rd-sp"></span>${stars(r.s)}</div><p>${r.t}</p>${r.reply ? `<div class="rd-reply"><b><span class="rd-av sm">SS</span>Reply from Shine Studio</b><p>${r.reply}</p></div>` : ""}<div class="foot"><span>Helpful (${r.help})</span><span>·</span><a href="#">Report</a>${extra}</div></article>`;
const SUMMARY = `<div class="rd-rsum"><div class="big"><b>4.8</b>${stars(4.8, "lg")}<small>126 reviews</small></div><div class="bars">${[[5, 98], [4, 19], [3, 5], [2, 3], [1, 1]].map(([s, c]) => `<div class="rd-score"><span>${s} ★</span><div class="bar"><i style="width:${Math.round((c / 126) * 100)}%"></i></div><b>${c}</b></div>`).join("")}</div></div>`;
const bizHead = (rating) => `<section class="wrap">
  <div class="rd-crumb"><a href="/">Home</a><span>/</span><a href="#">Wash &amp; Detailing</a><span>/</span><span>Shine Studio</span></div>
  <div class="rd-bizhead"><div class="rd-cover cv-a"><img class="o" src="${OBJ.wash}" alt=""></div>
    <div class="info"><h1 class="rd-h1" style="margin:0">Shine Studio</h1>
      <div class="rd-meta" style="font-size:15px;margin-top:10px">${rating}<span>·</span><span>Rosebank, Johannesburg</span><span>·</span><span class="open">●</span><span>Open until 18:00</span></div>
      <div class="rd-row" style="margin-top:14px"><span class="rd-lbl ok">Verified</span><span class="rd-lbl plain">Hand wash</span><span class="rd-lbl plain">Valet</span><span class="rd-lbl plain">Interior detail</span></div></div>
    <div class="acts"><a class="rd-btn" href="#">Send a message</a><a class="rd-btn light" href="#">Directions</a></div>
  </div>
</section>`;
const RATING = `${stars(4.8)}<span class="st">4.8</span><a class="rd-link" href="#reviews">126 reviews</a>`;
page(
  "A8-reviews/a8-1-cards.html",
  "Ratings on listing cards",
  `<section class="wrap"><div class="lp-head"><div><span class="lp-eyebrow">Wash &amp; Detailing near Rosebank</span><h2>Ratings on every card</h2></div></div>
  <div class="rd-grid">${[BIZ[0], BIZ[4], { ...BIZ[7], r: "", rc: 0 }].map((b) => b.rc ? bcard(b).replace(`<span class="st">★ ${b.r}</span><span>(${b.rc})</span>`, `${stars(+b.r)}<span class="st">${b.r}</span><span>(${b.rc})</span>`) : bcard(b).replace(`<span class="st">★ </span><span>(0)</span>`, `<span class="rd-lbl blue plain">New</span><span>No reviews yet</span>`)).join("")}</div></section>`,
);
page(
  "A8-reviews/a8-2-business-page-reviews.html",
  "Business page with reviews",
  `${bizHead(RATING)}
<section class="wrap" id="reviews" style="margin-top:40px">
  <div class="rd-revgrid">
    <div class="rd-stack"><h2 class="rd-h2">Reviews</h2>${SUMMARY}
      <div class="rd-note plain"><img src="${ic("shield")}" alt=""><div>Only customers who contacted this business through CarworX can review it.</div></div>
      <a class="rd-btn full" href="#">Write a review</a></div>
    <div><div class="rd-row" style="margin-bottom:14px"><span class="lp-chip on">Most recent</span><span class="lp-chip">Highest</span><span class="lp-chip">Lowest</span><span class="lp-chip">With a reply</span><span class="rd-sp"></span><small style="color:var(--muted)">126 reviews</small></div>
      ${REV.map((r, k) => revCard(r, k)).join("")}
      <p style="text-align:center;margin-top:18px"><a class="rd-btn light" href="#">Show more reviews</a></p></div>
  </div>
</section>`,
  { signed: true },
);
page(
  "A8-reviews/a8-3-write-review.html",
  "Write a review",
  `<section class="rd-narrow"><div class="rd-crumb"><a href="#">Shine Studio</a><span>/</span><span>Review</span></div><h1 class="rd-h1">How was Shine Studio?</h1><p class="rd-sub">You messaged them on 14 Nov. Your review shows your first name and initial.</p>
  <div class="rd-card rd-stack" style="margin-top:24px">
    <div class="rd-field"><span class="lb">Your rating</span><div class="rd-starpick">${stars(4, "xl")}<span>Good</span></div></div>
    <div class="rd-field"><label>Which service? (optional)</label><div class="rd-input">Headlight restoration <span class="rd-sp"></span>▾</div></div>
    <div class="rd-field"><label>Your review</label><div class="rd-input rd-area">Both lenses are clear again and the price matched what they said in the message. Took a bit longer than expected on a Saturday.</div><small>Say what happened, not who. 20 to 1 000 characters · 142 used.</small></div>
    <div class="rd-note plain"><img src="${ic("info")}" alt=""><div>One review per business. You can edit it later; we show "Edited" and the date.</div></div>
    <a class="rd-btn full" href="#">Post review</a>
  </div>
</section>`,
  { signed: true },
);
page(
  "A8-reviews/a8-4-cannot-review.html",
  "Write a review, not eligible",
  `<section class="rd-narrow"><div class="rd-crumb"><a href="#">Shine Studio</a><span>/</span><span>Review</span></div>
  <div class="rd-empty" style="margin-top:20px"><img src="${ill("noreply")}" alt=""><h2>Message them first.</h2><p>Only customers who contacted Shine Studio through CarworX can review it. That keeps reviews from real customers.</p><div class="rd-row"><a class="rd-btn" href="#">Send a message</a><a class="rd-btn light" href="#">Back to Shine Studio</a></div></div>
</section>`,
  { signed: true },
);
page(
  "A8-reviews/a8-5-owner-reply.html",
  "Business owner replies (in /provider)",
  `<section class="wrap"><div class="rd-crumb"><a href="#">Your business</a><span>/</span><span>Reviews</span></div><h1 class="rd-h1">Reviews</h1><p class="rd-sub">One public reply per review. Keep it short and polite; customers read replies as much as reviews.</p>
  <div class="rd-row" style="margin:22px 0 16px"><div class="rd-adm-tabs"><span class="on">Needs a reply <i>1</i></span><span>All <i>126</i></span></div><span class="rd-sp"></span><span class="rd-meta">${stars(4.8)}<span class="st">4.8</span><span>average</span></span></div>
  <div class="rd-revgrid one">
    <article class="rd-rev"><div class="top"><span class="rd-av coral">SK</span><div><b>Sipho K.</b><small>9 Nov 2026 · Headlight restoration</small></div><span class="rd-sp"></span>${stars(4)}</div><p>${REV[1].t}</p>
      <div class="rd-replybox"><div class="rd-field"><label>Your public reply</label><div class="rd-input rd-area focus">Thanks Sipho! Saturdays are our busiest day; we'll give you a time window next time so you can plan around it.</div><small>Shows as "Reply from Shine Studio". You can edit it, not add a second one.</small></div><div class="rd-row"><a class="rd-btn" href="#">Post reply</a><a class="rd-btn light" href="#">Cancel</a></div></div></article>
    ${revCard(REV[0], 0, '<span class="rd-sp"></span><a href="#">Edit reply</a>')}
  </div>
</section>`,
  { signed: true },
);
page(
  "A8-reviews/a8-6-report-review.html",
  "Report a review",
  `${bizHead(RATING)}<section class="wrap" style="margin-top:32px">${REV.map((r, k) => revCard(r, k)).join("")}</section>
  <div class="rd-dialog-scrim"></div>
  <div class="rd-dialog" role="dialog" aria-label="Report this review"><h2 class="rd-h2">Report this review</h2><p style="color:var(--muted);margin:6px 0 16px;font-size:14px">Our team checks every report. The reviewer isn't told who reported it.</p>
    <div class="rd-reasons"><div class="rd-radio on"><i></i>Not about a real visit or enquiry</div><div class="rd-radio"><i></i>Rude, hateful or threatening</div><div class="rd-radio"><i></i>Shares personal details</div><div class="rd-radio"><i></i>Spam or advertising</div><div class="rd-radio"><i></i>Something else</div></div>
    <div class="rd-field" style="margin-top:12px"><label>Anything else? (optional)</label><div class="rd-input"><span class="ph">Tell us what's wrong</span></div></div>
    <div class="rd-row" style="margin-top:16px"><a class="rd-btn" href="#">Send report</a><a class="rd-btn light" href="#">Cancel</a></div></div>`,
  { signed: true },
);
page(
  "A8-reviews/a8-7-admin-moderation.html",
  "Admin review moderation queue",
  `<section class="wrap"><div class="rd-crumb">Admin</div><h1 class="rd-h1">Reported reviews</h1><p class="rd-sub">Hide a review only when it breaks the rules. A low rating alone is never a reason.</p>
  <div class="rd-row" style="margin:22px 0 18px"><div class="rd-adm-tabs"><span class="on">Reported <i>3</i></span><span>Hidden <i>7</i></span><span>Kept <i>21</i></span></div></div>
  <div class="rd-review">
    <div class="rd-stack">
      ${[["AV", "Anika V.", "Shine Studio", 2, "Not about a real visit", "Business owner", "2 h"], ["TB", "Tumi B.", "TreadRight Tyres", 1, "Rude, hateful or threatening", "Customer", "5 h"], ["RP", "Riaan P.", "Kgosi Auto Repairs", 5, "Spam or advertising", "Customer", "1 d"]].map(([i, n, biz, s, why, by, age], k) => `<a class="rd-modrow${k === 0 ? " on" : ""}" href="#"><span class="rd-av${av(k)}">${i}</span><div><b>${n} → ${biz}</b><small>${why} · reported by ${by}</small></div><span class="rd-sp"></span>${stars(s)}<span class="rd-age">${age}</span></a>`).join("")}
    </div>
    <div class="rd-card rd-stack">
      <div class="rd-row"><h3 class="rd-h2" style="font-size:17px">Anika V. on Shine Studio</h3><span class="rd-sp"></span>${stars(2)}</div>
      <p style="margin:0">${REV[2].t}</p>
      <dl class="rd-kv"><dt>Enquiry on record</dt><dd>Yes · 24 Oct 2026</dd><dt>Reported by</dt><dd>Business owner · 2 h ago</dd><dt>Reason given</dt><dd>Not about a real visit</dd><dt>Other reviews by Anika</dt><dd>3, none reported</dd></dl>
      <div class="rd-note plain"><img src="${ic("info")}" alt=""><div>The enquiry on record shows a real contact, so this is likely a fair review.</div></div>
      <div class="rd-field"><label>Reason for your decision</label><div class="rd-input">Real enquiry on record; criticism is about the service</div></div>
      <div class="rd-row"><a class="rd-btn" href="#">Keep review</a><a class="rd-btn danger" href="#">Hide review</a></div>
      <p class="rd-hint" style="margin:0;text-align:left">Both sides get an email with your reason. Hidden reviews don't count in the rating.</p>
    </div>
  </div>
</section>`,
  { signed: true, admin: true, active: "reviews" },
);
page(
  "A8-reviews/a8-8-no-reviews.html",
  "Business page, no reviews yet",
  `${bizHead(`<span class="rd-lbl blue plain">New</span><span>No reviews yet</span>`)}
<section class="wrap" id="reviews" style="margin-top:40px"><div class="rd-empty"><img src="${ill("few")}" alt=""><h2>No reviews yet.</h2><p>Shine Studio is new on CarworX. Customers who send them a message can leave the first review.</p><div class="rd-row"><a class="rd-btn" href="#">Send a message</a></div></div></section>`,
);

writeFileSync(join(ROOT, "_src/manifest.json"), JSON.stringify(MANIFEST, null, 2));
console.log(`built ${MANIFEST.length} screens`);
