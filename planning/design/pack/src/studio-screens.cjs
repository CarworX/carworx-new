// One-off migration helper (kept for the record): restyles the pass-0 screen markup into Studio components.
// Content and states are unchanged; only wrappers, objects and illustrations are added.
const fs = require('fs');
const p = __dirname + '/parts/screens.html';
let s = fs.readFileSync(p, 'utf8');
const rep = (a, b, all) => { if (!s.includes(a)) { console.error('MISSING:', a.slice(0, 100)); process.exit(1); } s = all ? s.split(a).join(b) : s.replace(a, b); };

// section head
rep('<section class="sec" id="screens" aria-labelledby="screens-h">', '<section class="sec" id="screens" aria-labelledby="screens-h">');
rep('<span class="kicker">Part 3 · Layouts, phone first</span>', '<span class="eyebrow">Part 3 · Layouts, phone first</span>');
rep('<h2 id="screens-h">Eight phone screens, with the moments that matter</h2>', '<h2 class="h2" id="screens-h"><span class="ln">Eight phone screens,</span><span class="ln grey">with the moments that matter.</span></h2>');
rep('<p class="lead">Each group shows the main screen on a 360-pixel-wide phone, then the other states it must handle: waiting, expiring, failing, empty and paused. All businesses, people, prices and ratings are fictional. <span class="badge on-paper">Concept, not final</span></p>',
  '<p class="lede">Each group shows the main screen on a 360-pixel-wide phone, then the other states it must handle: waiting, expiring, failing, empty and paused. All businesses, people, prices and ratings are fictional.</p>\n    <p style="margin-top:var(--s3)"><span class="badge"><i></i>Concept, not final</span></p>');
rep('The five services get equal space and all five are visible on a small phone without scrolling (the orange dashed line marks the bottom of a 360 × 640 screen).', 'The five services get equal space and all five are visible on a small phone without scrolling (the orange dashed line marks the bottom of a 360 × 640 screen).');

// group numbers as mono labels
s = s.replace(/<h3>(\d)\. /g, '<h3><span class="k">0$1</span>');

// phone shells
s = s.replace(/(<figure class="phone" aria-label="[^"]+">)\s*<div class="scr">/g, '$1<div class="shell">\n        <div class="scr">');
s = s.replace(/<\/div>\n(\s*)<figcaption>/g, '</div></div>\n$1<figcaption>');

// home: soft-3D objects in the five key rows
for (const k of ['wash', 'repair', 'glass', 'tyre', 'fines']) rep(`<span class="sq">{{icon:${k}}}</span>`, `<span class="sq">{{obj:${k}}}</span>`);

// illustrations for empty and error states
const ill = (header, name) => rep(`${header}</span></header><div class="scr"><div class="bd">`, `${header}</span></header><div class="scr"><div class="bd">\n          {{ill:${name}}}`);
ill('· Limited supply', 'few');
s = s.replace('· Error</span></header><div class="scr"><div class="bd">', '· Error</span></header><div class="scr"><div class="bd">\n          {{ill:error}}');
ill('· Nothing nearby', 'nothing');
ill('· Could not load', 'error');
ill('· Business paused', 'paused');
ill('· Waiting for the business', 'sent');
ill('· No reply in time', 'noreply');
ill('· Quote expired', 'expired');
ill('· Payment failed', 'card');
ill('· Hold expired', 'expired');
ill('· Problem reported', 'review');
ill('· Under review', 'review');
ill('· Leaving CarworX', 'leave');

// listing photo placeholder: a hand-drawn car on the Studio gradient
rep('<div class="thumb">Photo placeholder · business\'s own photos go here</div>',
  '<div class="thumb"><svg viewBox="0 0 320 132" fill="none" stroke="#0d0f12" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity=".55" aria-hidden="true"><path d="M70 100 Q66 80 82 74 L106 68 L126 46 Q160 38 202 46 L226 68 L244 74 Q258 80 254 100Z"/><circle cx="108" cy="102" r="12" fill="#fff"/><circle cx="216" cy="102" r="12" fill="#fff"/><path d="M146 26c3 4 5 7 5 9a5 5 0 0 1-10 0c0-2 2-5 5-9zM176 16c2 3 4 5 4 7a4 4 0 0 1-8 0c0-2 2-4 4-7z"/></svg><span>Photo placeholder · business\'s own photos go here</span></div>');

// quote approval: the written quote is a receipt
rep('<div class="card lines">\n              <div><span>Front brake pads (parts)</span>', '<div class="rcpt"><span class="cap">WRITTEN QUOTE · VERSION 2</span>\n              <div><span>Front brake pads (parts)</span>');

// checkout: the hold timer is the Studio dial
rep(`<div class="card">
              <div class="between"><span class="small"><b>Your slot is held</b></span><span class="timer" aria-label="14 minutes 32 seconds left">14:32</span></div>
              <div class="bar"><i style="width:97%"></i></div>
              <p class="xs muted">If the time runs out, the slot is released and nothing is charged.</p>
            </div>`, `<div class="card hold">
              <div class="dial" role="img" aria-label="14 minutes 32 seconds left"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="80" fill="none" stroke="rgba(13,15,18,.07)" stroke-width="12"/><circle cx="100" cy="100" r="80" fill="none" stroke="#ff3b0a" stroke-width="12" stroke-linecap="round" stroke-dasharray="502.7" stroke-dashoffset="15"/></svg><div class="read"><b>14:32</b><small>held</small></div></div>
              <div style="margin:0"><b class="small">Your slot is held</b><p class="xs muted" style="margin:4px 0 0">If the time runs out, the slot is released and nothing is charged.</p></div>
            </div>`);

// confirmed: the booking tile
rep(`<div class="note ok">{{icon:check}}<span><b>Booked and paid.</b> Bubbleworks, Sat 31 Oct, 09:00–10:30. Ref <span class="price">CX-2048</span>.</span></div>`,
  `<div class="tile" style="box-shadow:var(--sh-1)"><div class="row"><span class="tick">{{icon:check}}</span><div><b>Booked and paid</b><small>Bubbleworks, Sat 31 Oct, 09:00–10:30</small></div></div><div class="meta"><span>Ref CX-2048</span><span>Paid to the business</span></div></div>`);

// business dashboard on a computer (EquipFlow style), demo numbers
rep(`          <span class="btn btn-s">{{icon:camera}} Add evidence</span>
        </div></div></div>
      </div>`, `          <span class="btn btn-s">{{icon:camera}} Add evidence</span>
        </div></div></div>
      </div>
      <div class="dash-wrap" data-reveal>
        <p class="eyebrow" style="margin-bottom:var(--s2)">On a computer · the same dashboard · demo numbers</p>
        <div class="dash-glow" aria-hidden="true"></div>
        <div class="dash" role="img" aria-label="Business dashboard on a computer for Bubbleworks (demo): 12 requests this week, R3 960 paid directly, average reply 1 hour 7 minutes against 2 hours, CarworX fee R0">
          <div class="dbar"><div class="who"><span class="av">BW</span><div><b>Bubbleworks Mobile Wash</b><small>Randburg and surrounds · demo</small></div></div><div class="ptabs"><span class="on">Requests</span><span>Quotes</span><span>Payments</span></div></div>
          <div class="dgrid">
            <div class="kpi"><small>Requests this week</small><span class="num">12</span><div class="foot"><div class="bar"><i style="--w:60%"></i></div>+3</div></div>
            <div class="kpi"><small>Paid to you directly</small><span class="num"><sub>R</sub>3 960</span><div class="foot">This week · 14 bookings</div></div>
            <div class="kpi"><small>Average reply</small><span class="num">1h07</span><div class="foot"><div class="bar"><i style="--w:56%"></i></div>of 2 h</div></div>
            <div class="kpi fee"><small>CarworX fee</small><span class="num"><sub>R</sub>0</span><div class="foot">Free during the pilot</div></div>
          </div>
        </div>
      </div>`);

fs.writeFileSync(p, s);
console.log('screens migrated');
