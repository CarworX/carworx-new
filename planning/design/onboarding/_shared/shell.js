/* CarworX signed-in menu (prototype). Every user, whatever their role, can reach
 * Profile and settings, Security (two-step sign-in) and Sign out from the menu.
 * Usage: SHELL.mount(el, { role: "driver|staff|manager|owner", current: "history" }). */
(() => {
  const ROOT = document.currentScript.src.replace(/_shared\/shell\.js.*$/, "");
  const WHO = {
    driver: { name: "Thandi Mokoena", ini: "TM", sub: "Driver" },
    staff: { name: "Lerato Mahlangu", ini: "LM", sub: "Staff · Shine Bay Car Wash" },
    manager: { name: "Ayanda Nkosi", ini: "AN", sub: "Manager · Shine Bay Car Wash" },
    owner: { name: "Sipho Dlamini", ini: "SD", sub: "Owner · Shine Bay Car Wash" },
    admin: { name: "Naledi Dube", ini: "ND", sub: "CarworX admin" },
  };
  const H = (p) => ROOT + p;
  const LINKS = {
    driver: [["Find a service", "#search"], ["Bookings", "#bookings"], ["History", "#history"]],
    staff: [["Today", "#today"], ["Requests", "#requests"], ["History", H("history/index.html?as=staff"), "history"]],
    manager: [["Today", "#today"], ["Requests", "#requests"], ["Earnings", H("earnings/index.html?as=manager"), "earnings"], ["History", H("history/index.html?as=manager"), "history"], ["Team", "#team"], ["Listing", "#listing"]],
    admin: [["Today", H("admin/index.html#today"), "today"], ["Applications", H("admin/index.html#applications"), "applications"], ["Claims", H("admin/index.html#claims"), "claims"], ["Businesses", H("admin/index.html#businesses"), "businesses"], ["Money", H("admin/index.html#money"), "money"], ["Audit log", H("admin/index.html#audit"), "audit"]],
    owner: [["Today", "#today"], ["Requests", "#requests"], ["Earnings", H("earnings/index.html?as=owner"), "earnings"], ["History", H("history/index.html?as=owner"), "history"], ["Team", "#team"], ["Listing", "#listing"], ["Business settings", H("account/index.html?as=owner&tab=business"), "business"]],
  };
  const acct = (role) => [
    ["Profile and settings", H(`account/index.html?as=${role}&tab=profile`), "profile"],
    ["Security and two-step sign-in", H(`account/index.html?as=${role}&tab=security`), "security"],
  ];
  function mount(el, { role, current }) {
    const w = WHO[role];
    const cur = (k) => (k === current ? ' aria-current="page"' : "");
    const links = LINKS[role];
    el.innerHTML = `<div class="ob-navwrap"><nav class="cx-nav sh-nav" aria-label="Main menu">
        <a class="logo" href="${H("index.html")}" aria-label="CarworX concepts board"><img src="${H("_shared/carworx-lockup-horizontal-ink.svg")}" alt="CarworX"></a>
        <ul class="sh-links">${links.map(([t, h, k]) => `<li><a href="${h}"${cur(k)}>${t}</a></li>`).join("")}</ul>
        <div class="sh-acct">
          <button type="button" class="sh-me" aria-expanded="false" aria-controls="sh-drop" data-sh-me><span class="sh-av">${w.ini}</span><span class="cx-vh">Account menu for ${w.name}</span></button>
          <div class="sh-drop" id="sh-drop" hidden>
            <p class="sh-who"><b>${w.name}</b><small>${w.sub}</small></p>
            ${acct(role).map(([t, h, k]) => `<a href="${h}"${cur(k)}>${t}</a>`).join("")}
            <button type="button" class="sh-out" data-sh-out>Sign out</button>
          </div>
        </div>
        <button type="button" class="cx-btn outlined sm sh-menubtn" aria-expanded="false" aria-controls="sh-sheet" data-sh-menu>Menu</button>
      </nav></div>
      <div class="sh-sheet" id="sh-sheet" hidden>
        <p class="sh-who"><span class="sh-av">${w.ini}</span><span><b>${w.name}</b><small>${w.sub}</small></span></p>
        ${links.map(([t, h, k]) => `<a href="${h}"${cur(k)}>${t}${k === current ? "<small>you're here</small>" : ""}</a>`).join("")}
        <hr>
        ${acct(role).map(([t, h, k]) => `<a href="${h}"${cur(k)}>${t}</a>`).join("")}
        <button type="button" class="sh-out" data-sh-out>Sign out</button>
      </div>
      <div class="sh-signedout" hidden role="dialog" aria-modal="true" aria-labelledby="sh-so-h"><div>
        <h2 id="sh-so-h">You're signed out</h2><p>Signed out on this device. To sign out everywhere, use Security.</p>
        <button type="button" class="cx-btn primary" data-sh-back>Sign in again</button><p class="t-cap">Prototype: nothing was sent.</p></div></div>`;
    const drop = el.querySelector(".sh-drop");
    const me = el.querySelector("[data-sh-me]");
    const sheet = el.querySelector(".sh-sheet");
    const mb = el.querySelector("[data-sh-menu]");
    const so = el.querySelector(".sh-signedout");
    const toggle = (panel, btn, open = panel.hidden) => {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (open) panel.querySelector("a, button")?.focus();
    };
    me.addEventListener("click", () => toggle(drop, me));
    mb.addEventListener("click", () => toggle(sheet, mb));
    el.querySelectorAll("[data-sh-out]").forEach((b) =>
      b.addEventListener("click", () => {
        drop.hidden = sheet.hidden = true;
        so.hidden = false;
        so.querySelector("button").focus();
      }),
    );
    el.querySelector("[data-sh-back]").addEventListener("click", () => {
      so.hidden = true;
      me.focus();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!drop.hidden) toggle(drop, me, false), me.focus();
      if (!sheet.hidden) toggle(sheet, mb, false), mb.focus();
    });
    document.addEventListener("click", (e) => {
      if (!drop.hidden && !e.target.closest(".sh-acct")) toggle(drop, me, false);
    });
  }
  window.SHELL = { mount, WHO };
})();
