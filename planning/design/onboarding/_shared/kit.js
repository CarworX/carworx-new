/* CarworX onboarding concepts: shared kit. Synthetic data, no backend, no network.
 *
 * 1. Questions: <div data-q="services"></div> is filled from Q below. One spec, many looks:
 *    each concept restyles .ob-qt (label, headline or chat bubble). body[data-voice="chat"]
 *    swaps in the friendlier wording.
 * 2. Screens: <div data-screen="review|submitted|waiting|live|card|nav"></div>.
 * 3. Flow: <form data-flow> holding [data-step] sections. One step shows at a time.
 *    [data-next] [data-back] [data-go="id"] [data-change="q"]. Enter = Next, Esc = Back.
 *    data-if="path=claim" hides steps/elements; data-require="a,b" blocks Next until answered;
 *    data-count marks steps that count in [data-progress] / [data-progress-label];
 *    data-section + [data-rail] [data-for] drive a step rail. Deep link: #step-id.
 */
(() => {
  const SERVICES = [
    "Wash & Detailing",
    "Mechanical service",
    "Panel and paint",
    "Auto electrical",
    "Mobile mechanic",
    "Glass Repair & Replacement",
    "Tyres & Wheel Alignment",
  ];
  const METROS = [
    "Johannesburg",
    "Tshwane (Pretoria)",
    "Ekurhuleni",
    "Cape Town",
    "eThekwini (Durban)",
    "Nelson Mandela Bay",
    "Buffalo City",
    "Mangaung",
  ];
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const PHRASES = [
    "Hand wash only",
    "Same-day service",
    "Free written quotes",
    "Family-run",
    "Eco-friendly products",
    "Secure parking while you wait",
    "Fleet work welcome",
  ];
  // Fictional listings to claim.
  const LISTINGS = [
    ["Shine Bay Car Wash", "Rosebank, Johannesburg · Wash & Detailing"],
    ["Jacaranda Tyre & Align", "Hatfield, Tshwane · Tyres & Wheel Alignment"],
    ["Mzansi Mobile Mechanics", "Comes to you · Ekurhuleni · Mobile mechanic"],
  ];
  const SUBURBS = [
    ["Parkhurst", "Rosebank", "Illovo"],
    ["Parktown", "Saxonwold", "Melrose"],
    ["Braamfontein", "Houghton", "Orange Grove"],
  ];

  const I = {
    store:
      '<path d="M4 10v9h16v-9M3 10l2-6h14l2 6M3 10h18M9 19v-5h6v5"/>',
    van: '<path d="M3 16V7h11v9M14 10h4l3 3v3h-7M7.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    mail: '<path d="M3 6h18v12H3zM3 7l9 6 9-6"/>',
    doc: '<path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5"/>',
    tick: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    lock: '<path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
    pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z"/><circle cx="12" cy="10" r="2.2"/>',
    loc: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    team: '<circle cx="9" cy="9" r="3"/><path d="M3 19a6 6 0 0 1 12 0M16 6.5a3 3 0 0 1 0 5.5M17.5 19H21a5 5 0 0 0-4-5"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  };
  const ic = (n) =>
    `<svg class="ob-ic" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

  // ---------- question specs ----------
  const tiles = (o) => o.map(([v, d, i]) => ({ v, d, i }));
  const Q = {
    path: {
      t: "What would you like to do?",
      chat: "Hi! Are you new to CarworX, or is your business already listed?",
      type: "tiles",
      opts: tiles([
        ["List a new business", "Start fresh. Takes about 2 minutes.", "plus"],
        [
          "Claim an existing listing",
          "Your business is already on CarworX and you run it.",
          "flag",
        ],
      ]),
      vals: ["new", "claim"],
    },
    name: {
      t: "What's your business called?",
      chat: "Great. What's your business called?",
      h: "As customers know it. Typed field 1 of 2.",
      type: "text",
      ph: "For example, Shine Bay Car Wash",
      max: 160,
    },
    role: {
      t: "What's your role?",
      chat: "And you are the…",
      type: "pick",
      opts: ["Owner", "Manager", "Staff"],
    },
    services: {
      t: "What services do you offer?",
      chat: "What can customers book with you? Pick all that apply.",
      h: "Pick all that apply. The first one you pick is your main service.",
      type: "pick",
      multi: true,
      opts: SERVICES,
    },
    mode: {
      t: "Where do you serve customers?",
      chat: "Where do customers find you? Pick one or both.",
      h: "Pick one or both. Many businesses have a workshop and do call-outs too.",
      type: "tiles",
      multi: true,
      opts: tiles([
        ["They come to me", "A workshop or wash bay customers drive to.", "store"],
        ["I go to them", "Mobile: you travel to the customer.", "van"],
      ]),
    },
    metro: {
      t: "Which metro or area?",
      chat: "Which metro or area do you work in?",
      type: "select",
      opts: METROS,
    },
    pin: {
      t: "Drop a pin on your premises",
      chat: "Drop a pin where customers should arrive.",
      h: "Search for your exact address, tap the map, or use your location. Customers see this on your listing.",
      type: "pin",
      if: "mode=They come to me",
    },
    base: {
      t: "Where do you start from, and how far will you go?",
      chat: "Where do you usually start from, and how far will you travel?",
      h: "Search for an exact address, tap the map, or use your location. Used only to match you with nearby customers.",
      type: "base",
      if: "mode=I go to them",
    },
    hours: {
      t: "When are you open?",
      chat: "When can customers book you?",
      h: "Tap the days you work. You can add exceptions later.",
      type: "hours",
    },
    staff: {
      t: "How many people work there?",
      chat: "How big is the team?",
      type: "pick",
      opts: ["Just me", "2–5", "6–15", "16+"],
    },
    since: {
      t: "Trading since",
      chat: "When did you start trading? (Optional.)",
      h: "Optional. Pick any date in the month you started.",
      type: "date",
      opt: true,
    },
    about: {
      t: "Say what you do in one line",
      chat: "Last bit: tell customers what you do, in one line.",
      h: "Tap a phrase to add it, or type your own. Typed field 2 of 2.",
      type: "area",
      max: 200,
      ph: "For example, Hand wash only. Same-day service.",
    },
    adult: {
      t: "I'm 18 or older",
      type: "switch",
      h: "We don't ask for your date of birth or ID number.",
    },
    consent: {
      t: "These details are true, and I may list this business.",
      tc: "I run this business and may manage its listing.",
      type: "consent",
    },
    claimListing: {
      t: "Which listing is yours?",
      chat: "Which of these is your business?",
      h: "Listings near your area. Not here? Start a new listing instead.",
      type: "listings",
    },
    evidence: {
      t: "How can we check it's yours?",
      chat: "How can we check it's yours?",
      type: "tiles",
      opts: tiles([
        [
          "Business email",
          "Your sign-in email is at the business's own domain.",
          "mail",
        ],
        [
          "Show an admin a document",
          "An admin looks at it with you. Don't upload it here.",
          "doc",
        ],
      ]),
    },
    doc: {
      t: "Which document will you show?",
      chat: "Which document will you show the admin?",
      h: "Pick the type and its date. Nothing is uploaded.",
      type: "pick",
      opts: [
        "Utility bill",
        "CIPC registration letter",
        "Bank confirmation letter",
        "Lease agreement",
      ],
      if: "evidence=Show an admin a document",
    },
    // ---- Phase 2: finish setup (after approval) ----
    invRole: {
      t: "What will they do?",
      h: "Owners and managers can invite people. Only the owner can change payment settings.",
      type: "tiles",
      opts: tiles([
        ["Manager", "Edits the listing, handles requests and invites people.", "user"],
        ["Staff", "Handles the requests they're given. Can't edit the listing.", "team"],
      ]),
    },
    invHow: {
      t: "How should we invite them?",
      type: "tiles",
      opts: tiles([
        ["Email invite", "We email them a link. Typed field: their email.", "mail"],
        ["Share a link", "A one-time link or QR code you send yourself. Nothing to type.", "flag"],
      ]),
    },
    invEmail: {
      t: "Their email address",
      h: "They sign in with their own account. Never share your login.",
      type: "text",
      it: "email",
      ac: "email",
      ph: "For example, lerato@example.co.za",
      max: 254,
      if: "invHow=Email invite",
    },
    assign: {
      t: "Who picks the staff member for a booking?",
      h: "You can change this any time.",
      type: "tiles",
      opts: tiles([
        ["The customer picks", "Customers see your team's first names and choose who they get.", "user"],
        ["We assign", "An owner or manager assigns each booking. Customers book the business.", "store"],
      ]),
    },
    anyone: {
      t: "Also offer \"Anyone available\"",
      h: "Customers who don't mind who they get can book sooner.",
      type: "switch",
    },
    contact: {
      t: "What can staff see about a customer?",
      h: "Owners and managers always see full details. Share only what staff need (POPIA).",
      type: "tiles",
      opts: tiles([
        ["Name and phone number", "Staff can call the customer about their booking.", "user"],
        ["First name only", "Staff see who's coming, but not how to contact them.", "eye"],
        ["Booking details only", "Service, time and place. No customer details.", "lock"],
      ]),
    },
    teamMfa: {
      t: "Two-step sign-in for your team",
      h: "You decide. A 6-digit code from an authenticator app at each sign-in; anyone can get the code by email if their app gives trouble.",
      type: "tiles",
      opts: tiles([
        ["Optional", "Managers and staff choose for themselves.", "user"],
        ["Required for managers", "Managers set it up; staff choose.", "lock"],
        ["Required for everyone", "Managers and staff set it up when they join.", "team"],
      ]),
    },
    cover: {
      t: "Pick a cover photo",
      h: "Prototype: synthetic swatches stand in for your photos.",
      type: "pick",
      opts: ["Bay at sunrise", "Foam wash", "Workshop floor"],
    },
    // ---- Staff join ----
    myServices: {
      t: "What do you work on?",
      chat: "What do you work on?",
      h: "From Shine Bay Car Wash's services. Pick all that apply.",
      type: "pick",
      multi: true,
      opts: ["Wash & Detailing", "Glass Repair & Replacement"],
    },
    myDays: {
      t: "Which days do you work?",
      h: "Within the business's opening days.",
      type: "pick",
      multi: true,
      opts: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    firstName: {
      t: "Your first name, as customers see it",
      h: "Shown because this business lets customers pick who they get. First name only.",
      type: "text",
      ac: "given-name",
      ph: "For example, Lerato",
      max: 40,
    },
    docDate: {
      t: "Document date",
      type: "date",
      if: "evidence=Show an admin a document",
    },
  };
  const voice = () => document.body.dataset.voice;
  let uid = 0;

  function title(q, k) {
    return (voice() === "chat" && q.chat) || q.t;
  }
  function wrap(k, q, inner, forId) {
    const id = `q-${k}-${++uid}`;
    const t = title(q, k);
    const opt = q.opt ? ' <span class="ob-opt">(optional)</span>' : "";
    const head = forId
      ? `<label class="ob-qt" id="${id}-t" for="${forId}">${t}${opt}</label>`
      : `<p class="ob-qt" id="${id}-t">${t}${opt}</p>`;
    const hint = q.h ? `<p class="ob-qh" id="${id}-h">${q.h}</p>` : "";
    const ifAttr = q.if ? ` data-if="${esc(q.if)}"` : "";
    const role = forId ? "" : ` role="group" aria-labelledby="${id}-t"`;
    const desc = q.h ? ` aria-describedby="${id}-h"` : "";
    return `<div class="ob-q ob-q-${k}"${role}${forId ? "" : desc}${ifAttr}>${head}${hint}${inner(id, desc)}<p class="ob-err" role="alert" data-err="${k}"></p></div>`;
  }
  const R = {
    text: (k, q) => {
      const fid = `f-${k}-${uid + 1}`;
      return wrap(
        k,
        q,
        (id, desc) =>
          `<input class="ob-input" id="${fid}" name="${k}" type="${q.it || "text"}" maxlength="${q.max}" autocomplete="${q.ac || "organization"}" placeholder="${esc(q.ph)}"${desc}>`,
        fid,
      );
    },
    area: (k, q) => {
      const fid = `f-${k}-${uid + 1}`;
      return wrap(
        k,
        q,
        (id, desc) =>
          `<div class="ob-picks" role="group" aria-label="Starter phrases">${PHRASES.map((p) => `<button type="button" class="cx-chip" data-phrase="${k}" aria-pressed="false">+ ${p}</button>`).join("")}</div>
          <textarea class="ob-input" id="${fid}" name="${k}" maxlength="${q.max}" rows="3" placeholder="${esc(q.ph)}"${desc}></textarea>
          <span class="ob-count" data-countof="${k}" aria-live="polite">0 / ${q.max}</span>`,
        fid,
      );
    },
    pick: (k, q) =>
      wrap(
        k,
        q,
        () =>
          `<div class="ob-picks">${q.opts.map((o) => `<label class="ob-pick${q.multi ? " multi" : ""}"><input type="${q.multi ? "checkbox" : "radio"}" name="${k}" value="${esc(o)}"${q.multi ? " data-multi" : ""}>${esc(o)}</label>`).join("")}</div>`,
      ),
    tiles: (k, q) =>
      wrap(
        k,
        q,
        () =>
          `<div class="ob-tiles">${q.opts.map((o, i) => `<label class="ob-tile${q.multi ? " multi" : ""}"><input type="${q.multi ? "checkbox" : "radio"}" name="${k}" value="${esc(q.vals ? q.vals[i] : o.v)}"${q.multi ? " data-multi" : ""}><span class="ic">${ic(o.i)}</span><b>${o.v}</b><small>${o.d}</small></label>`).join("")}</div>`,
      ),
    listings: (k, q) =>
      wrap(
        k,
        q,
        () =>
          `<div class="ob-tiles" style="grid-template-columns:1fr">${LISTINGS.map(([n, m]) => `<label class="ob-tile"><input type="radio" name="${k}" value="${esc(n)}"><span class="ic">${ic(/Comes to you/.test(m) ? "van" : "store")}</span><b>${n}</b><small>${m}</small></label>`).join("")}</div>
          <button type="button" class="ob-link" data-newinstead>Not listed? Start a new listing instead</button>`,
      ),
    select: (k, q) => {
      const fid = `f-${k}-${uid + 1}`;
      return wrap(
        k,
        q,
        (id, desc) =>
          `<select class="ob-input" id="${fid}" name="${k}"${desc}><option value="">Choose…</option>${q.opts.map((o) => `<option>${o}</option>`).join("")}</select>`,
        fid,
      );
    },
    date: (k, q) => {
      const fid = `f-${k}-${uid + 1}`;
      return wrap(
        k,
        q,
        (id, desc) =>
          `<input class="ob-input" type="date" id="${fid}" name="${k}" min="1950-01-01" max="2026-11-11"${desc}>`,
        fid,
      );
    },
    switch: (k, q) =>
      `<div class="ob-q ob-q-${k}"><label class="ob-switch"><span><span class="ob-qt">${q.t}</span>${q.h ? `<span class="ob-qh" style="display:block;font-weight:400">${q.h}</span>` : ""}</span><input type="checkbox" role="switch" name="${k}" value="Yes"><span class="track" aria-hidden="true"></span></label><p class="ob-err" role="alert" data-err="${k}"></p></div>`,
    consent: (k, q) =>
      `<div class="ob-q ob-q-${k}"><div class="ob-consent"><label class="cx-check"><input type="checkbox" name="${k}" value="Yes"><span class="cx-box" aria-hidden="true">${ic("tick")}</span><span data-consent-text>${q.t}</span></label></div><p class="ob-err" role="alert" data-err="${k}"></p></div>`,
    hours: (k, q) =>
      wrap(
        k,
        q,
        () => {
          const opts = (sel) => {
            let s = "";
            for (let m = 5 * 60; m <= 22 * 60; m += 30) {
              const t = `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`;
              s += `<option${t === sel ? " selected" : ""}>${t}</option>`;
            }
            return s;
          };
          return `<div class="ob-days">${DAYS.map((d, i) => `<label class="ob-day"><input type="checkbox" name="days" value="${d}" data-multi${i < 5 ? " checked" : ""}><span>${d}</span></label>`).join("")}</div>
          <div class="ob-times"><label>Opens<select class="ob-input" name="open">${opts("08:00")}</select></label><label>Closes<select class="ob-input" name="close">${opts("17:00")}</select></label></div>`;
        },
      ),
    pin: (k, q) => wrap(k, q, () => mapHtml(k, false)),
    base: (k, q) =>
      wrap(
        k,
        q,
        () =>
          mapHtml(k, true) +
          `<div class="ob-range"><div class="row"><label for="rad-${uid}">How far you'll travel</label><output for="rad-${uid}" data-bind="radius" data-suffix=" km">20 km</output></div><input type="range" id="rad-${uid}" name="radius" min="5" max="60" step="5" value="20"></div>
          <p class="ob-private">${ic("lock")}<span><b>Private.</b> Customers never see your base or your radius. Your listing only says you come to them, in your metro.</span></p>`,
      ),
  };

  // A synthetic street map (not to scale, no real data).
  const MAP_SVG = (() => {
    let s = `<svg viewBox="0 0 160 110" preserveAspectRatio="none" aria-hidden="true"><rect width="160" height="110" fill="#e9e7e2"/>`;
    s += `<rect x="96" y="58" width="30" height="22" rx="3" fill="#e3eaff"/><rect x="18" y="70" width="22" height="16" rx="3" fill="#e3eaff"/>`;
    for (let x = 10; x < 160; x += 18)
      s += `<path d="M${x} 0V110" stroke="#fff" stroke-width="2.4"/>`;
    for (let y = 8; y < 110; y += 16)
      s += `<path d="M0 ${y}H160" stroke="#fff" stroke-width="2.4"/>`;
    s += `<path d="M-5 100 L165 12" stroke="#fff" stroke-width="5"/><path d="M-5 100 L165 12" stroke="#dedcd6" stroke-width="0.6"/>`;
    s += `<path d="M30 -5 C60 40 70 70 150 115" stroke="#fff" stroke-width="4" fill="none"/>`;
    s += "</svg>";
    return s;
  })();
  const PIN = `<svg class="pin" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43s15-14 15-26A15 15 0 0 0 2 17c0 12 15 26 15 26Z" fill="#0d0f12"/><circle cx="17" cy="17" r="5.5" fill="#fff"/></svg>`;
  // Synthetic places for the search (prototype). Live: server-side temporary geocoding,
  // used once to choose a point and never stored (D-082). x/y are map fractions.
  const PLACES = [
    ["12 Jan Smuts Avenue", "Saxonwold, Johannesburg", 0.5, 0.5],
    ["Oxford Road & Bath Avenue", "Rosebank, Johannesburg", 0.5, 0.17],
    ["Corlett Drive", "Illovo, Johannesburg", 0.84, 0.2],
    ["4th Avenue", "Parkhurst, Johannesburg", 0.16, 0.2],
    ["Victoria Avenue", "Parktown, Johannesburg", 0.18, 0.5],
    ["High Street", "Melrose, Johannesburg", 0.83, 0.47],
    ["Houghton Drive", "Houghton, Johannesburg", 0.5, 0.8],
    ["De Korte Street", "Braamfontein, Johannesburg", 0.15, 0.82],
    ["Louis Botha Avenue", "Orange Grove, Johannesburg", 0.84, 0.8],
  ];
  function mapHtml(k, ring) {
    const id = `ms-${k}-${uid}`;
    return `<div class="ob-mapsearch">
        <label class="cx-vh" for="${id}">Search for an address or place</label>
        <input class="ob-input" id="${id}" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list" autocomplete="off" placeholder="Search an address or place" data-mapsearch="${k}">
        <ul class="ob-results" id="${id}-list" role="listbox" aria-label="Places" hidden></ul>
      </div>
      <div class="ob-map" tabindex="0" data-map="${k}" role="application" aria-roledescription="map" aria-label="Map. Click or tap to drop a pin. With a keyboard, press Enter to drop it in the middle, then use the arrow keys to move it.">${MAP_SVG}${ring ? '<span class="ring" hidden></span>' : ""}<span class="pinwrap" hidden>${PIN}</span><span class="tag">Synthetic map · not to scale</span></div>
      <div class="ob-maprow"><p class="ob-pinread" aria-live="polite" data-pinread="${k}">Search, tap the map, or use your location</p><button type="button" class="cx-btn outlined sm" data-locate="${k}">${ic("loc")} Use my location</button></div>
      <div class="ob-perm" data-perm="${k}" role="region" aria-label="Location permission" hidden>
        <span class="ic">${ic("loc")}</span>
        <div><b>Allow CarworX to use your location?</b><p>We use it once to place your pin${k === "base" ? ". Your base stays private" : ""}. We don't track you or keep your device's location. Your browser will ask you next.</p>
        <div class="acts"><button type="button" class="cx-btn primary sm" data-allow="${k}">Allow location</button><button type="button" class="ob-link" data-notnow="${k}">Not now</button></div></div>
      </div>
      <input type="hidden" name="${k}">`;
  }

  // ---------- screens ----------
  const REVIEW_ROWS = [
    ["Business", "name", "name", "path=new"],
    ["Listing", "claimListing", "claimListing", "path=claim"],
    ["Your role", "role", "role"],
    ["Services", "services", "services", "path=new"],
    ["Customers", "mode", "mode", "path=new"],
    ["Metro or area", "metro", "metro", "path=new"],
    ["Location", "whereText", "loc", "path=new"],
    ["Hours", "hoursText", "hours", "path=new"],
    ["Team size", "staff", "staff", "path=new"],
    ["Trading since", "sinceText", "since", "path=new"],
    ["About", "about", "about", "path=new"],
    ["Proof", "proofText", "evidence", "path=claim"],
  ];
  const LABELS = ["Identity checked", "Business details checked", "Premises visited"];
  const S = {
    nav: (el) =>
      `<div class="ob-navwrap"><nav class="cx-nav" aria-label="CarworX"><a class="logo" href="../index.html" aria-label="CarworX concepts board"><img src="../_shared/carworx-lockup-horizontal-ink.svg" alt="CarworX"></a><div class="act"><span class="ob-demo">${esc(el.dataset.label || "Concept")}</span><a class="cx-btn outlined sm" href="#welcome" data-restart>Save and exit</a></div></nav></div>`,
    review: () =>
      `<dl class="ob-review">${REVIEW_ROWS.map(([l, b, c, iff]) => `<div${iff ? ` data-if="${iff}"` : ""}><dt>${l}</dt><dd data-bind="${b}" data-empty="Not answered"></dd><button type="button" class="ob-link" data-change="${c}">Change<span class="cx-vh"> ${l}</span></button></div>`).join("")}</dl>
      <p class="ob-private" data-if="path=claim">${ic("eye")}<span><b>Nothing changes on the listing</b> until an admin approves your claim. We never ask for ID numbers or your date of birth.</span></p>
      <p class="ob-private" data-if="path!=claim">${ic("eye")}<span><b>What's public:</b> your name, services, hours, about line and <span data-if="mode=They come to me">premises pin</span><span data-if="mode=They come to me&mode=I go to them"> and </span><span data-if="mode=I go to them">"Comes to you" with your metro</span>. <span data-if="mode=I go to them">Your base and radius stay private.</span> We never ask for ID numbers or your date of birth.</span></p>`,
    submitted: () =>
      `<div class="ob-status"><div class="ob-tickbig">${ic("tick")}</div>
      <p class="cx-eyebrow">Sent · <span data-bind="sentAt"></span></p>
      <h2 class="t-head" data-if="path=new">Application sent</h2><h2 class="t-head" data-if="path=claim">Claim sent</h2>
      <p class="t-lede">A CarworX admin checks every <span data-if="path=new">application</span><span data-if="path=claim">claim</span> before anything changes in search, and records how they checked it. We'll email you at your sign-in address either way.</p>
      <h3 class="t-title" style="margin-top:8px">What happens next</h3>
      <ol class="cx-steps">
        <li><span class="k"><span class="n" aria-hidden="true">01</span>${ic("tick")}</span><div><span class="cx-actor">You</span><b>Sent</b><p>Your answers are saved. You can still change them while you wait.</p></div></li>
        <li aria-current="step"><span class="k"><span class="n" aria-hidden="true">02</span>${ic("eye")}</span><div><span class="cx-actor carworx">CarworX</span><b>An admin checks it</b><p>By phone, your documents or a visit. Each check becomes a label: Identity checked, Business details checked<span data-if="mode=They come to me">, Premises visited</span>.</p></div></li>
        <li><span class="k"><span class="n" aria-hidden="true">03</span>${ic("flag")}</span><div><span class="cx-actor">You</span><b>You're live</b><p data-if="path=new">Your listing appears in search with the labels you earned.</p><p data-if="path=claim">You manage the listing. If someone already manages it, they can dispute your claim first.</p></div></li>
        <li><span class="k"><span class="n" aria-hidden="true">04</span>${ic("clock")}</span><div><span class="cx-actor business">Business</span><b>Your first request</b><p>You have 2 business hours to accept a booking request.</p></div></li>
      </ol></div>`,
    waiting: () =>
      `<div class="ob-status">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="cx-label warn">Waiting for review</span><span class="t-cap">Not in search yet</span></div>
      <h2 class="t-head" data-bind="name|claimListing" data-empty="Your business"></h2>
      <div class="ob-dashgrid">
        <section class="ob-panel"><h3>What the admin checks</h3><ul class="ob-checks">
          <li><span class="dot"></span>Identity checked<small>to do</small></li>
          <li><span class="dot"></span>Business details checked<small>to do</small></li>
          <li data-if="mode=They come to me"><span class="dot"></span>Premises visited<small>to do</small></li>
        </ul><p class="t-cap">Labels appear on your listing only once an admin ticks them.</p></section>
        <section class="ob-panel"><h3>While you wait</h3><ul class="ob-checks">
          <li class="done"><span class="dot">${ic("tick")}</span>Application sent</li>
          <li class="done" data-if="path=new"><span class="dot">${ic("tick")}</span>Opening hours added</li>
          <li><span class="dot"></span>Add a cover photo<small>optional</small></li>
          <li><span class="dot"></span>Invite your team<small>after approval</small></li>
        </ul></section>
        <section class="ob-panel" data-if="path=new"><h3>Your listing, as customers will see it</h3><div data-screen="card"></div></section>
      </div>
      <p class="ob-private">${ic("mail")}<span>We'll email your sign-in address when it's reviewed. You don't need to keep this page open.</span></p>
      <div><button type="button" class="cx-btn outlined sm" data-go="live">Demo: see it approved</button></div></div>`,
    live: () =>
      `<div class="ob-status">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="cx-label">Live</span><span class="t-cap">In search now</span></div>
      <h2 class="t-head">You're live, <span data-bind="name|claimListing" data-empty="your business"></span></h2>
      <p class="t-lede">An admin checked your <span data-if="path=new">application</span><span data-if="path=claim">claim</span>. These labels now show on your listing.</p>
      <div class="ob-dashgrid"><section class="ob-panel"><h3>Your labels</h3><div class="lbls" data-labels="live" style="display:flex;gap:6px;flex-wrap:wrap"></div><p class="t-cap">Only checks an admin actually did. Premises visited is for fixed premises only.</p></section>
      <section class="ob-panel" data-if="path=new"><h3>Your listing</h3><div data-screen="card" data-live></div></section>
      <section class="ob-panel"><h3>Next: finish setup</h3><ul class="ob-checks"><li><span class="dot"></span>Invite your team</li><li><span class="dot"></span>Who gets the booking</li><li><span class="dot"></span>Add a cover photo</li></ul><a class="cx-btn primary sm" href="../setup/index.html" style="justify-self:start">Finish setup</a></section></div></div>`,
    card: (el) =>
      `<article class="ob-card" aria-label="Listing preview"><div class="top"><span class="av" data-bind="initials" aria-hidden="true">?</span><div><h3 data-bind="name" data-empty="Your business name"></h3><p class="m"><span data-bind="publicWhere" data-empty="Your area"></span></p></div></div>
      <div class="svcs" data-chips="services"><span class="empty">Your services</span></div>
      <p class="about" data-bind="about" data-empty="A short line about what you do."></p>
      <p class="m">${ic("clock").replace('class="ob-ic"', 'class="ob-ic" style="width:14px;height:14px;vertical-align:-2px"')} <span data-bind="hoursText" data-empty="Your hours"></span></p>
      <div class="lbls" data-labels="${el.hasAttribute("data-live") ? "live" : "pending"}"></div></article>`,
  };

  // ---------- state ----------
  function stateOf(form) {
    const fd = new FormData(form);
    const multi = new Set(
      [...form.querySelectorAll("[data-multi]")].map((i) => i.name),
    );
    const s = {};
    for (const k of new Set(fd.keys()))
      s[k] = multi.has(k) ? fd.getAll(k) : fd.get(k);
    for (const k of multi) if (!(k in s)) s[k] = [];
    const modes = [].concat(s.mode || []);
    const mob = modes.includes("I go to them");
    const fix = modes.includes("They come to me");
    s.fixed = fix;
    s.hoursText = s.days?.length
      ? `${dayRange(s.days)} · ${s.open}–${s.close}`
      : "";
    // A10: a mobile base and radius never reach the public text. Both modes: premises + "also comes to you".
    const premises = fix && s.pinArea ? `${s.pinArea}${s.metro ? ", " + s.metro : ""}` : "";
    s.publicWhere = fix && mob
      ? `${premises || s.metro || "Your area"} · also comes to you`
      : mob
        ? `Comes to you · ${s.metro || "your metro"}`
        : premises || s.metro || "";
    s.whereText = [
      fix && s.pin ? `Premises pin near ${s.pinArea}` : "",
      mob && s.base ? `Private base set · travels up to ${s.radius} km (never shown)` : "",
    ].filter(Boolean).join(" · ");
    s.sinceText = s.since ? fmtDate(s.since) : "";
    s.proofText =
      s.evidence === "Show an admin a document"
        ? [s.doc, s.docDate && fmtDate(s.docDate)].filter(Boolean).join(", ") ||
          "Document (not chosen yet)"
        : s.evidence || "";
    s.initials = (s.name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
    s.sentAt = sast();
    return s;
  }
  function dayRange(d) {
    const idx = d.map((x) => DAYS.indexOf(x)).sort((a, b) => a - b);
    const runs = [];
    for (const i of idx) {
      const r = runs.at(-1);
      if (r && r[1] === i - 1) r[1] = i;
      else runs.push([i, i]);
    }
    return runs
      .map(([a, b]) =>
        a === b ? DAYS[a] : b === a + 1 ? `${DAYS[a]}, ${DAYS[b]}` : `${DAYS[a]}–${DAYS[b]}`,
      )
      .join(", ");
  }
  function fmtDate(v) {
    const d = new Date(v + "T12:00:00");
    return d.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  function sast() {
    const d = new Date(Date.now() + 2 * 3600e3);
    return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} SAST`;
  }
  const empty = (v) => v == null || v === "" || (Array.isArray(v) && !v.length);
  function matches(cond, s) {
    if (!cond) return true;
    return cond.split("&").every((c) => {
      const neg = c.includes("!=");
      const [k, v] = c.split(neg ? "!=" : "=");
      const val = s[k];
      const hit = Array.isArray(val) ? val.includes(v) : val === v;
      return neg ? !hit : hit;
    });
  }

  // ---------- flow ----------
  function Flow(form) {
    const steps = [...form.querySelectorAll("[data-step]")];
    const byId = (id) => steps.find((s) => s.id === id);
    const stack = [];
    let cur = null;
    let ret = null;
    let s = stateOf(form);
    const visible = (st) => matches(st.dataset.if, s);

    function update() {
      s = stateOf(form);
      form.querySelectorAll("[data-if]").forEach((el) => {
        if (!el.hasAttribute("data-step")) el.hidden = !matches(el.dataset.if, s);
      });
      form.querySelectorAll("[data-bind]").forEach((el) => {
        const v = el.dataset.bind
          .split("|")
          .map((k) => s[k])
          .find((x) => !empty(x));
        const txt = empty(v)
          ? el.dataset.empty || ""
          : (Array.isArray(v) ? v.join(", ") : v) + (el.dataset.suffix || "");
        el.textContent = txt;
        el.classList.toggle("empty", empty(v));
      });
      form.querySelectorAll("[data-chips]").forEach((el) => {
        const v = s[el.dataset.chips] || [];
        el.innerHTML = v.length
          ? v.map((x) => `<span>${esc(x)}</span>`).join("")
          : '<span class="empty">Your services</span>';
      });
      form.querySelectorAll("[data-labels]").forEach((el) => {
        const fixed = s.fixed || empty(s.mode);
        const ls = LABELS.filter((l, i) => i < 2 || fixed);
        el.innerHTML =
          el.dataset.labels === "live" || form.dataset.live
            ? ls.map((l) => `<span class="cx-label">${ic("tick").replace('class="ob-ic"', 'class="ob-ic" style="width:12px;height:12px;stroke-width:2.6"')} ${l}</span>`).join("")
            : '<span class="ob-lbl-off">Labels appear after an admin checks you</span>';
      });
      form.querySelectorAll("[data-consent-text]").forEach((el) => {
        el.textContent = s.path === "claim" ? Q.consent.tc : Q.consent.t;
      });
      form.querySelectorAll("[data-countof]").forEach((el) => {
        el.textContent = `${(s[el.dataset.countof] || "").length} / ${Q[el.dataset.countof].max}`;
      });
      form.dispatchEvent(new CustomEvent("ob:change", { detail: s }));
      progress();
    }

    function progress() {
      if (!cur) return;
      const group = cur.dataset.group || "";
      const counted = steps.filter(
        (st) =>
          st.hasAttribute("data-count") &&
          visible(st) &&
          (st.dataset.group || "") === group,
      );
      let i = counted.indexOf(cur);
      if (i < 0) {
        const before = steps.slice(0, steps.indexOf(cur));
        i = counted.filter((c) => before.includes(c)).length - 1;
        if (cur.dataset.done !== undefined) i = counted.length - 1;
      }
      const p = counted.length ? (i + 1) / counted.length : 0;
      form.querySelectorAll("[data-progress]").forEach((el) => {
        if ((el.dataset.progress || "") === group || !el.dataset.progress) {
          el.style.setProperty("--p", p);
          el.setAttribute("aria-valuenow", Math.round(p * 100));
        }
      });
      form.querySelectorAll("[data-progress-label]").forEach((el) => {
        el.textContent =
          i >= 0 && cur.hasAttribute("data-count")
            ? `${i + 1} of ${counted.length}`
            : el.dataset.progressLabel || "";
      });
      const name =
        cur.dataset.title || cur.querySelector("h2")?.textContent.trim() || "";
      form.querySelectorAll("[data-segbar]").forEach((el) => segbar(el, i, counted.length, name));
      const sec = cur.dataset.section;
      form.querySelectorAll("[data-rail]").forEach((rail) => {
        const items = [...rail.querySelectorAll("[data-for]")];
        const at = items.findIndex((li) => li.dataset.for === sec);
        items.forEach((li, j) => {
          if (j === at) li.setAttribute("aria-current", "step");
          else li.removeAttribute("aria-current");
          li.classList.toggle("done", at >= 0 && j < at);
        });
        rail.hidden = at < 0 && rail.dataset.hideOff !== undefined;
      });
    }

    // Segmented progress: one segment per counted step. Forward fills the next segment(s)
    // left to right; back drains them right to left; a multi-step jump chains them in order.
    function segbar(el, at, n, name) {
      let row = el.querySelector(".segs");
      if (!row) {
        el.innerHTML = `<div class="segrow"><span class="segname" aria-hidden="true"></span><span class="segcount" aria-hidden="true"></span></div><div class="segs"></div>`;
        row = el.querySelector(".segs");
        el.setAttribute("role", "progressbar");
        el.setAttribute("aria-valuemin", "0");
      }
      const prev = el._at;
      const fresh = el._n !== n;
      if (!fresh && prev === at && el._name === name) return;
      if (fresh) {
        row.innerHTML = Array.from({ length: n }, () => '<span class="seg"><i></i></span>').join("");
        el.classList.add("still");
      }
      const segs = [...row.children];
      const dur = 420;
      const from = fresh || prev == null ? at : prev;
      const span = Math.abs(at - from);
      const per = span > 1 ? Math.min(dur * 0.55, 640 / span) : 0;
      segs.forEach((sg, k) => {
        const on = k <= at;
        let d = 0;
        if (at > from && k > from && k <= at) d = (k - from - 1) * per; // forward: left to right
        if (at < from && k > at && k <= from) d = (from - k) * per; // back: right to left
        sg.firstChild.style.transitionDelay = d + "ms";
        sg.classList.toggle("on", on);
        sg.classList.toggle("now", k === at);
      });
      el.setAttribute("aria-valuemax", n);
      el.setAttribute("aria-valuenow", at + 1);
      el.setAttribute("aria-valuetext", `Step ${at + 1} of ${n}${name ? ": " + name : ""}`);
      const nm = el.querySelector(".segname");
      const ct = el.querySelector(".segcount");
      const dir = at >= from ? "fwd" : "back";
      if (nm.textContent !== name || ct.textContent !== `${at + 1} of ${n}`) {
        nm.textContent = name;
        ct.textContent = `${at + 1} of ${n}`;
        if (!fresh && prev != null && prev !== at) {
          [nm, ct].forEach((x) => {
            x.classList.remove("fwd", "back");
            void x.offsetWidth;
            x.classList.add(dir);
          });
        }
      }
      if (fresh) {
        void el.offsetWidth;
        el.classList.remove("still");
      }
      el._at = at;
      el._n = n;
      el._name = name;
    }
    function show(id, focus = true) {
      const st = byId(id);
      if (!st) return;
      cur = st;
      steps.forEach((x) => (x.hidden = x !== st));
      form.dataset.step = id;
      form.dataset.kind = st.dataset.kind || "";
      if (id === "live") form.dataset.live = "1";
      else delete form.dataset.live;
      history.replaceState(null, "", "#" + id);
      // data-only="review submitted" shows on those step ids or data-kind values; "!x" hides on x.
      const tags = [id, ...(st.dataset.kind || "").split(" ")];
      form.querySelectorAll("[data-only]").forEach((el) => {
        const t = el.dataset.only.split(" ");
        const pos = t.filter((x) => !x.startsWith("!"));
        const neg = t.filter((x) => x.startsWith("!")).map((x) => x.slice(1));
        el.hidden = (pos.length && !pos.some((x) => tags.includes(x))) || neg.some((x) => tags.includes(x));
      });
      // A step's data-cta renames the shared Next button (e.g. "Send application").
      form.querySelectorAll("button[data-next][data-cta]").forEach((b) => (b.textContent = st.dataset.cta || b.dataset.cta));
      update();
      if (form.dataset.noscroll === undefined) window.scrollTo({ top: 0 });
      if (focus) {
        const h = st.querySelector("[data-focus], h1, h2, .ob-qt");
        if (h) {
          h.setAttribute("tabindex", "-1");
          h.focus({ preventScroll: true });
        }
      }
      requestAnimationFrame(() => bars(st));
      form.dispatchEvent(new CustomEvent("ob:step", { detail: { id, step: st, s } }));
    }
    function go(id) {
      stack.push(id);
      show(id);
    }
    function nextOf(st) {
      if (st.dataset.next) return st.dataset.next;
      for (let j = steps.indexOf(st) + 1; j < steps.length; j++)
        if (visible(steps[j]) && steps[j].dataset.skip === undefined) return steps[j].id;
      return null;
    }
    const MSG = {
      name: "Add your business name (at least 2 letters).",
      invEmail: "Add their email address.",
      firstName: "Add your first name.",
      consent: "Tick this to send.",
      adult: "You need to be 18 or older to list a business.",
      pin: "Drop a pin on the map, or use your location.",
      base: "Drop a pin on the map, or use your location.",
    };
    function validate(st) {
      st.querySelectorAll("[data-err]").forEach((e) => (e.textContent = ""));
      st.querySelectorAll("[aria-invalid]").forEach((e) => e.removeAttribute("aria-invalid"));
      let bad = null;
      for (const k of (st.dataset.require || "").split(",").filter(Boolean)) {
        const box = st.querySelector(`[data-err="${k}"]`);
        if (!box || box.closest("[hidden]")) continue;
        const v = s[k];
        if (k === "name" ? (v || "").trim().length >= 2 : !empty(v)) continue;
        box.textContent = MSG[k] || "Choose an answer to carry on.";
        const q = box.closest(".ob-q");
        const inp = q.querySelector("input:not([type=hidden]), select, textarea, .ob-map");
        if (inp && /text|date|select/.test(inp.type || "")) inp.setAttribute("aria-invalid", "true");
        bad ??= inp || box;
      }
      if (bad) bad.focus();
      return !bad;
    }
    function next() {
      update();
      if (!validate(cur)) return;
      const to = ret || nextOf(cur);
      ret = null;
      if (to) go(to);
    }
    function back() {
      if (stack.length > 1) {
        stack.pop();
        show(stack.at(-1));
        return;
      }
      for (let j = steps.indexOf(cur) - 1; j >= 0; j--)
        if (visible(steps[j]) && steps[j].dataset.skip === undefined) {
          stack.splice(0, stack.length, steps[j].id);
          return show(steps[j].id);
        }
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      next();
    });
    // Clear a question's error as soon as its answer changes.
    const clearErr = (e) => {
      const q = e.target.closest?.(".ob-q");
      if (!q) return;
      q.querySelectorAll("[data-err]").forEach((x) => (x.textContent = ""));
      q.querySelectorAll("[aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid"));
    };
    form.addEventListener("input", (e) => (clearErr(e), update()));
    form.addEventListener("change", clearErr);
    let lastPointer = 0;
    form.addEventListener("pointerdown", () => (lastPointer = Date.now()));
    form.addEventListener("change", (e) => {
      update();
      if (Date.now() - lastPointer > 800) return; // keyboard: never jump
      // Single-choice steps can move on by themselves (concept opt-in).
      if (
        form.dataset.autonext !== undefined &&
        e.target.type === "radio" &&
        cur.querySelectorAll(".ob-q").length === 1 &&
        cur.dataset.require
      )
        setTimeout(next, 260);
    });
    form.addEventListener("click", (e) => {
      const t = e.target.closest("button, a");
      if (!t) return;
      if (t.hasAttribute("data-next")) (e.preventDefault(), next());
      else if (t.hasAttribute("data-back")) (e.preventDefault(), back());
      else if (t.dataset.go) (e.preventDefault(), go(t.dataset.go));
      else if (t.dataset.change) {
        e.preventDefault();
        ret = cur.id;
        const q = t.dataset.change === "loc" ? (s.fixed ? "pin" : "base") : t.dataset.change;
        const st = steps.find((x) => x.querySelector(`[data-q="${q}"]`) && visible(x));
        if (st) go(st.id);
      } else if (t.dataset.phrase) {
        const ta = form.querySelector(`[name="${t.dataset.phrase}"]`);
        const add = t.textContent.replace(/^\+\s*/, "");
        if (!ta.value.includes(add)) {
          const v = (ta.value.trim() ? ta.value.trim().replace(/[.]?$/, ". ") : "") + add + ".";
          if (v.length <= ta.maxLength) ta.value = v;
        }
        t.setAttribute("aria-pressed", "true");
        update();
      } else if (t.hasAttribute("data-newinstead")) {
        e.preventDefault();
        const r = form.querySelector('[name="path"][value="new"]');
        if (r) r.checked = true;
        update();
        const st = steps.find((x) => x.querySelector('[data-q="name"]'));
        if (st) go(st.id);
      } else if (t.hasAttribute("data-restart")) {
        e.preventDefault();
        stack.length = 0;
        go(steps[0].id);
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.isComposing) return;
      const tag = e.target.tagName;
      if (e.key === "Escape" && tag !== "SELECT") {
        e.preventDefault();
        back();
      } else if (
        e.key === "Enter" &&
        !e.shiftKey &&
        !["TEXTAREA", "BUTTON", "A", "SELECT"].includes(tag) &&
        !e.target.closest("[data-map]")
      ) {
        e.preventDefault();
        next();
      }
    });

    window.addEventListener("hashchange", () => {
      const id = location.hash.slice(1);
      if (byId(id) && id !== cur.id) go(id);
    });
    maps(form, update);
    // "Save and exit" goes to this flow's own first step.
    form.querySelectorAll("[data-restart]").forEach((x) => (x.href = "#" + steps[0].id));
    const start = location.hash.slice(1);
    const first = byId(start) ? start : steps[0].id;
    // Deep links (for screenshots) can preset answers: #step?mode=I go to them&path=claim
    stack.push(first);
    show(first, false);
    return { go, next, back, update, state: () => s, show };
  }

  // ---------- map pin ----------
  function maps(form, update) {
    form.querySelectorAll("[data-map]").forEach((map) => {
      const k = map.dataset.map;
      const pin = map.querySelector(".pinwrap");
      const ring = map.querySelector(".ring");
      const hidden = form.querySelector(`input[type=hidden][name="${k}"]`);
      const read = form.querySelector(`[data-pinread="${k}"]`);
      let x = 0.5;
      let y = 0.5;
      let areaIn = form.querySelector('input[name="pinArea"]');
      if (!areaIn && k === "pin") {
        areaIn = Object.assign(document.createElement("input"), { type: "hidden", name: "pinArea" });
        form.append(areaIn);
      }
      function place(nx, ny, note, label) {
        x = Math.min(0.97, Math.max(0.03, nx));
        y = Math.min(0.95, Math.max(0.08, ny));
        pin.hidden = false;
        pin.firstChild.style.left = x * 100 + "%";
        pin.firstChild.style.top = y * 100 + "%";
        const area = SUBURBS[Math.min(2, Math.floor(y * 3))][Math.min(2, Math.floor(x * 3))];
        const lat = (-26.12 - y * 0.06).toFixed(4);
        const lng = (28.0 + x * 0.08).toFixed(4);
        hidden.value = `${lat}, ${lng}`;
        if (areaIn && k === "pin") areaIn.value = area;
        const where = label ? `at ${esc(label)}` : `near ${area}`;
        read.innerHTML =
          k === "base"
            ? `Base ${where}<small>${note || "Private: only you and CarworX admins see this"}</small>`
            : `Pin ${where}<small>${note || hidden.value + " · synthetic"}</small>`;
        if (ring) sizeRing();
        update();
      }
      function sizeRing() {
        if (pin.hidden) return;
        const r = +form.querySelector('[name="radius"]').value;
        const d = (r / 60) * 0.9 * map.clientWidth;
        ring.hidden = false;
        Object.assign(ring.style, { left: x * 100 + "%", top: y * 100 + "%", width: d + "px", height: d + "px" });
      }
      pin.style.cssText = "position:absolute;inset:0;pointer-events:none";
      pin.firstChild.style.position = "absolute";
      map.addEventListener("click", (e) => {
        const r = map.getBoundingClientRect();
        place((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      });
      map.addEventListener("keydown", (e) => {
        const d = { ArrowLeft: [-0.03, 0], ArrowRight: [0.03, 0], ArrowUp: [0, -0.04], ArrowDown: [0, 0.04] }[e.key];
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          place(x, y);
        } else if (d) {
          e.preventDefault();
          place(x + d[0], y + d[1]);
        }
      });
      // "Use my location" explains first; only "Allow" triggers the browser's own prompt.
      const perm = form.querySelector(`[data-perm="${k}"]`);
      form.querySelector(`[data-locate="${k}"]`).addEventListener("click", () => {
        perm.hidden = false;
        perm.querySelector("[data-allow]").focus();
      });
      perm.querySelector("[data-notnow]").addEventListener("click", () => {
        perm.hidden = true;
        read.textContent = "No problem. Search or tap the map instead.";
        form.querySelector(`[data-locate="${k}"]`).focus();
      });
      perm.querySelector("[data-allow]").addEventListener("click", () => {
        perm.hidden = true;
        read.textContent = "Finding you…";
        if (!navigator.geolocation)
          return (read.textContent = "Location isn't available here. Search or tap the map instead.");
        navigator.geolocation.getCurrentPosition(
          () => place(0.5, 0.5, "From your device, used once. Demo: shown at the map centre, nothing is sent."),
          () => (read.textContent = "Location was blocked or unavailable. Search or tap the map instead."),
          { timeout: 8000 },
        );
      });
      // Search: a combobox over synthetic places. Arrow keys move, Enter picks, Esc closes.
      const box = form.querySelector(`[data-mapsearch="${k}"]`);
      const list = box.nextElementSibling;
      let hits = [];
      let act = -1;
      const close = () => {
        list.hidden = true;
        box.setAttribute("aria-expanded", "false");
        box.removeAttribute("aria-activedescendant");
        act = -1;
      };
      const paint = () => {
        list.innerHTML = hits.length
          ? hits.map(([a, b], j) => `<li role="option" id="${list.id}-${j}" aria-selected="${j === act}" data-hit="${j}"><b>${esc(a)}</b><small>${esc(b)}</small></li>`).join("") + '<li class="note" aria-hidden="true">Synthetic results · prototype</li>'
          : '<li class="note">No matches. Try a street or suburb.</li>';
        list.hidden = false;
        box.setAttribute("aria-expanded", "true");
        if (act >= 0) box.setAttribute("aria-activedescendant", `${list.id}-${act}`);
      };
      const pick = (j) => {
        const [a, b, px, py] = hits[j];
        box.value = `${a}, ${b}`;
        close();
        place(px, py, k === "base" ? "Private: only you and CarworX admins see this" : `${b} · exact point you chose`, `${a}, ${b.split(",")[0]}`);
      };
      box.addEventListener("input", () => {
        const t = box.value.trim().toLowerCase();
        act = -1;
        if (t.length < 2) return close();
        hits = PLACES.filter(([a, b]) => (a + " " + b).toLowerCase().includes(t));
        paint();
      });
      box.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (list.hidden || !hits.length) return;
          act = (act + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length;
          paint();
        } else if (e.key === "Enter") {
          e.preventDefault(); // never "Next" from the search box
          if (!list.hidden && hits.length) pick(act >= 0 ? act : 0);
        } else if (e.key === "Escape" && !list.hidden) {
          e.preventDefault(); // close the list instead of going Back
          close();
        }
      });
      list.addEventListener("mousedown", (e) => {
        const li = e.target.closest("[data-hit]");
        if (li) {
          e.preventDefault();
          pick(+li.dataset.hit);
        }
      });
      box.addEventListener("blur", () => setTimeout(close, 120));
      if (ring)
        form.querySelector('[name="radius"]').addEventListener("input", sizeRing);
      map._place = place;
    });
  }

  // ---------- boot ----------
  function render(root = document) {
    root.querySelectorAll("[data-q]").forEach((el) => {
      const k = el.dataset.q;
      el.outerHTML = R[Q[k].type](k, Q[k]).replace("<div ", `<div data-q="${k}" `);
    });
    root.querySelectorAll("[data-screen]").forEach((el) => {
      const html = S[el.dataset.screen](el);
      el.innerHTML = html;
      el.querySelectorAll("[data-screen]").forEach((c) => (c.innerHTML = S[c.dataset.screen](c)));
    });
  }
  // Demo presets for screenshots: ?preset=fixed|mobile|claim fills synthetic answers.
  function preset(form, name, flow) {
    const set = (k, v) => {
      form.querySelectorAll(`[name="${k}"]`).forEach((i) => {
        if (i.type === "radio" || i.type === "checkbox") i.checked = [].concat(v).includes(i.value);
        else i.value = v;
      });
    };
    if (name === "claim") {
      set("path", "claim");
      set("claimListing", "Shine Bay Car Wash");
      set("role", "Owner");
      set("evidence", "Show an admin a document");
      set("doc", "Utility bill");
      set("docDate", "2026-10-03");
    } else {
      const mob = name === "mobile";
      set("path", "new");
      set("name", mob ? "Mzansi Mobile Mechanics" : "Shine Bay Car Wash");
      set("role", "Owner");
      set("services", mob ? ["Mobile mechanic", "Auto electrical"] : ["Wash & Detailing", "Glass Repair & Replacement"]);
      set("mode", mob ? ["I go to them"] : name === "both" ? ["They come to me", "I go to them"] : ["They come to me"]);
      set("metro", mob ? "Ekurhuleni" : "Johannesburg");
      set("staff", "2–5");
      set("since", "2019-03-01");
      set("days", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
      set("about", mob ? "We come to your home or office. Free written quotes." : "Hand wash only. Secure parking while you wait.");
    }
    set("adult", "Yes");
    flow.update();
    if (name !== "claim")
      form.querySelectorAll("[data-map]").forEach((m) => m._place(0.48, 0.42));
  }

  // ---------- swipeable bars ----------
  // Filter and tab bars are one row that scrolls sideways (setup chips still wrap). Fades mark the side
  // with more; a vertical wheel scrolls it sideways; focus and the chosen item stay in view.
  const BAR = ".ob-filterbar, .cx-tabs, .ob-scrollrow";
  function fade(el) {
    const max = el.scrollWidth - el.clientWidth;
    el.classList.toggle("ob-more-l", el.scrollLeft > 2);
    el.classList.toggle("ob-more-r", max - el.scrollLeft > 2);
  }
  function toChosen(el) {
    const on = el.querySelector('input:checked, [aria-pressed="true"], [aria-selected="true"]');
    if (!on) return;
    const item = on.closest(".ob-filterbar > *, .cx-tabs > *, .ob-scrollrow > *") || on;
    const l = item.offsetLeft - el.offsetLeft;
    if (l < el.scrollLeft || l + item.offsetWidth > el.scrollLeft + el.clientWidth)
      el.scrollLeft = Math.max(0, l - 8);
  }
  function bar(el) {
    // Re-rendered contents: bring the chosen item into view again.
    const sig = el.children.length + ":" + (el.firstElementChild?.textContent || "");
    if (el._bar) {
      if (el._sig !== sig) (el._sig = sig), toChosen(el);
      return fade(el);
    }
    el._bar = true;
    el._sig = sig;
    el.addEventListener("scroll", () => fade(el), { passive: true });
    el.addEventListener(
      "wheel",
      (e) => {
        if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        const max = el.scrollWidth - el.clientWidth;
        if ((e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return;
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      },
      { passive: false },
    );
    el.addEventListener("focusin", (e) => {
      const item = e.target.closest(".ob-filterbar > *, .cx-tabs > *, .ob-scrollrow > *") || e.target;
      item.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    toChosen(el);
    fade(el);
  }
  function bars(root = document) {
    root.querySelectorAll(BAR).forEach(bar);
  }
  // Keep new or re-rendered bars wired (pages that re-render, step changes, resizes).
  new MutationObserver(() => bars()).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", () => bars());
  document.addEventListener("DOMContentLoaded", () => bars());

  // Read-only map for admin review: points [{x, y, kind: "pin"|"base", r?: km}].
  function mapStatic(points, label) {
    const pins = points
      .map((p) =>
        p.kind === "base"
          ? `<span class="ring" style="left:${p.x * 100}%;top:${p.y * 100}%;width:${(p.r / 60) * 90}%;aspect-ratio:1;height:auto"></span><span class="basedot" style="left:${p.x * 100}%;top:${p.y * 100}%"></span>`
          : `<span class="pinwrap" style="position:absolute;inset:0"><svg class="pin" viewBox="0 0 34 44" style="left:${p.x * 100}%;top:${p.y * 100}%" aria-hidden="true"><path d="M17 43s15-14 15-26A15 15 0 0 0 2 17c0 12 15 26 15 26Z" fill="#0d0f12"/><circle cx="17" cy="17" r="5.5" fill="#fff"/></svg></span>`,
      )
      .join("");
    return `<div class="ob-map" role="img" aria-label="${esc(label)}" style="cursor:default">${MAP_SVG}${pins}<span class="tag">Synthetic map · not to scale</span></div>`;
  }

  window.OB = {
    mapStatic,
    bars,
    Q,
    matches,
    ic,
    esc,
    boot() {
      render();
      const form = document.querySelector("[data-flow]");
      const flow = Flow(form);
      const p = new URLSearchParams(location.search).get("preset");
      if (p) preset(form, p, flow);
      window.flow = flow;
      return flow;
    },
  };
})();
