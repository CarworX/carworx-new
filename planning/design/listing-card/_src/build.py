#!/usr/bin/env python3
"""Listing card options A-D: builds one self-contained gallery page.

Usage: python3 build.py <photo-dir> <out.html>
<photo-dir> holds p1.jpg..p5.jpg (see README for the Unsplash photo IDs).
Fonts and service objects come from planning/design/redesign-2026-11/_shared.
"""
import base64, io, pathlib, sys
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[4]
SHARED = ROOT / "planning/design/redesign-2026-11/_shared"
photos_dir, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])


def b64(p: bytes) -> str:
    return base64.b64encode(p).decode()


def photo(n: int) -> str:
    im = Image.open(photos_dir / f"p{n}.jpg").convert("RGB")  # drops EXIF
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=70, optimize=True, progressive=True)
    return b64(buf.getvalue())


geist = b64((SHARED / "fonts/Geist-latin.woff2").read_bytes())
glass = b64((SHARED / "objects/carworx-object-glass-repair.svg").read_bytes())

# Times as at Saturday 12:35 SAST. Closing-soon threshold: 60 minutes.
CARDS = [
    dict(name="Marula Motorworks", ph=1, area="Milnerton, Cape Town", svc="General service",
         rating=(4.8, 126), st="open", txt="Open", sub="closes 14:00",
         checks=["Business details checked", "Identity checked", "Premises visited"]),
    dict(name="Sizwe Tyre & Align", ph=2, area="Midrand, Johannesburg", svc="Tyre fitting",
         rating=(4.6, 41), st="soon", txt="Closes in 25 min", sub="at 13:00",
         checks=["Business details checked", "Identity checked"]),
    dict(name="Glenwood Gloss Studio", ph=3, area="Glenwood, Durban", svc="Valet and detailing",
         rating=None, st="closed", txt="Closed", sub="opens tomorrow 09:00",
         checks=["Business details checked"]),
    dict(name="Kestrel Glass Fitment", ph=None, area="Westdene, Bloemfontein", svc="Windscreen replacement",
         rating=(4.9, 18), st="closed", txt="Closed", sub="opens Mon 08:00",
         checks=["Business details checked", "Identity checked", "Premises visited"]),
    dict(name="Thabo Mobile Service", ph=4, area="Serves Soweto and surrounds", svc="Mobile mechanic",
         rating=None, st="none", txt="Hours not listed", sub="ask when you enquire",
         checks=["Identity checked"], mobile=True),
    dict(name="Ridgeview Brake & Clutch", ph=5, area="Scottsville, Pietermaritzburg", svc="Brakes and clutch",
         rating=(4.3, 9), st="open", txt="Open", sub="closes 15:00",
         checks=["Business details checked", "Identity checked"]),
]
CHECK_ICON = {"Business details checked": "i-doc", "Identity checked": "i-user", "Premises visited": "i-bay"}


def ic(name, cls="ic"):
    return f'<svg class="{cls}" aria-hidden="true"><use href="#{name}"/></svg>'


def status(c, cls="st", short=False):
    sub = f' <span class="sub">· {c["sub"]}</span>' if c["sub"] and not (short and c["st"] == "none") else ""
    return f'<span class="{cls} st-{c["st"]}">{ic("s-" + c["st"], "mk")}<span class="tx"><b>{c["txt"]}</b>{sub}</span></span>'


def rating(c, short=False):
    if not c["rating"]:
        return '<span class="rt"><span class="new">New</span></span>'
    avg, n = c["rating"]
    stars = "★" * round(avg) + "☆" * (5 - round(avg))
    label = f"{avg:.1f} out of 5 · {n} review{'s' if n != 1 else ''}"
    if short:
        return (f'<span class="rt" aria-label="{label}"><span class="stars" aria-hidden="true">★</span>'
                f'<b>{avg:.1f}</b> <span class="n">({n})</span></span>')
    return f'<span class="rt"><span class="stars" aria-hidden="true">{stars}</span> {label}</span>'


def cover(c, inner=""):
    if c["ph"]:
        return f'<span class="cv ph{c["ph"]}">{inner}</span>'
    mono = "".join(w[0] for w in c["name"].split()[:2])
    return (f'<span class="cv fb"><img class="obj" src="data:image/svg+xml;base64,{glass}" alt="">'
            f'<span class="mono" aria-hidden="true">{mono}</span>{inner}</span>')


def come(c):
    return f'<span class="come">{ic("i-car")}Comes to you</span>' if c.get("mobile") else ""


def pop(c):
    items = "".join(f"<li>{ic(CHECK_ICON[k])}{k}</li>" for k in c["checks"])
    return f'<span class="pop" role="tooltip"><b>What CarworX checked</b><ul>{items}</ul></span>'


def verified(c, open_=False, mode="chip"):
    n = len(c["checks"])
    label = f"Verified: {n} check{'s' if n != 1 else ''}"
    o = " open" if open_ else ""
    if mode == "icon":
        return (f'<span class="vf vf-ic{o}" tabindex="0" aria-label="{label}">{ic("i-shield")}'
                f'<span class="cnt">{n}</span>{pop(c)}</span>')
    if mode == "trio":
        icons = "".join(f'<span class="tri" title="{k}">{ic(CHECK_ICON[k])}</span>' for k in c["checks"])
        return (f'<span class="vf vf-trio{o}" tabindex="0" aria-label="{label}">{icons}'
                f'<span class="cnt">{n} check{"s" if n != 1 else ""}</span>{pop(c)}</span>')
    return (f'<span class="vf vf-chip{o}" tabindex="0" aria-label="{label}">{ic("i-shield")}Verified'
            f'<span class="cnt">· {n}</span>{pop(c)}</span>')


def card_a(c, op=False):
    over = f'<span class="ov-tl">{status(c, "st pill", True)}</span><span class="ov-tr">{verified(c, op, "icon")}</span>{come(c)}'
    return (f'<a class="card ca" href="#a">{cover(c, over)}<span class="body"><h3>{c["name"]}</h3>'
            f'{rating(c)}<span class="meta">{ic("i-pin")}{c["area"]}</span>'
            f'<span class="svc">{c["svc"]}</span></span></a>')


def card_b(c, op=False):
    return (f'<a class="card cb" href="#b">{cover(c, come(c))}<span class="body">'
            f'<span class="hd"><h3>{c["name"]}</h3></span>{rating(c)}'
            f'<span class="row">{ic("i-pin")}{c["area"]}</span>'
            f'<span class="row">{status(c)}</span>'
            f'<span class="ft"><span class="svc">{c["svc"]}</span>{verified(c, op, "trio")}</span></span></a>')


def card_c(c, op=False):
    return (f'<a class="card cc" href="#c">{cover(c)}<span class="body">'
            f'<h3>{c["name"]}</h3><span class="l2">{rating(c, True)}<span class="svc">{c["svc"]}</span></span>'
            f'<span class="meta">{ic("i-pin")}{c["area"]}</span>{status(c)}'
            f'<span class="l4">{verified(c, op, "chip")}{come(c)}</span></span></a>')


def card_d(c, op=False):
    over = (f'{come(c)}<span class="name"><h3>{c["name"]}</h3>{verified(c, op, "icon")}</span>'
            f'<span class="rtw">{rating(c)}</span>')
    return (f'<a class="card cd" href="#d">{cover(c, over)}'
            f'<span class="strip st-{c["st"]}">{status(c)}<span class="hrs">Hours{ic("i-chev")}</span></span>'
            f'<span class="body"><span class="meta">{ic("i-pin")}{c["area"]}</span>'
            f'<span class="svc">{c["svc"]}</span></span></a>')


OPTS = [
    ("a", "Photo with status overlay", card_a,
     "The open status sits on the photo, so it is the first thing the eye lands on, and the photo keeps the whole top half.",
     "Frosted status pill top left; a shield badge with the number of checks top right (tap or hover lists them). Name, rating, area and service underneath."),
    ("b", "Photo plus a clean info stack", card_b,
     "Nothing covers the photo and every fact gets its own line with an icon, which is the easiest to scan and the most robust for screen readers.",
     "Rows: name, rating, area, open status. The footer pairs the service with one small icon per check (business details, identity, premises)."),
    ("c", "Compact horizontal card", card_c,
     "Half the height of A or B, so about twice as many businesses fit on a phone screen: best for long search results.",
     "Square photo on the left, four short lines on the right. Rating shortened to ★ 4.8 (126); the full wording stays for screen readers."),
    ("d", "Status strip (recommended)", card_d,
     "The name on the photo reads like a shopfront sign, and a full-width coloured strip answers 'can I go now?' without reading.",
     "Name, verified badge and rating on a dark fade at the foot of the photo; a tinted strip with the status and an Hours link; area and service below."),
]


def frame(fn, kind, cards):
    inner = "".join(fn(c, kind == "desk" and i == 0) for i, c in enumerate(cards))
    return f'<div class="grid g-{kind}">{inner}</div>'


def option(key, title, fn, why, how):
    desk = frame(fn, "desk", CARDS)
    m1, m2, m3 = (frame(fn, "mob", CARDS[j:j + 2]) for j in (0, 2, 4))
    return f"""
<section class="opt" id="opt-{key}">
  <header class="oh"><span class="let">{key.upper()}</span><div><h2>{title}</h2><p class="why">{why}</p><p class="how">{how}</p></div></header>
  <div class="views">
    <figure class="desk"><figcaption>Desktop · 1280 grid, 3 per row</figcaption>
      <div class="zoomer"><div class="screen sd" data-shot="{key}-desktop-1280"><div class="ctx"><h4>6 businesses near you</h4><span class="sort">Sorted by distance</span></div>{desk}</div></div>
    </figure>
    <figure class="mob"><figcaption>Mobile · 390, the same list scrolled down</figcaption>
      <div class="phones" data-shot="{key}-mobile-390"><div class="screen sm"><div class="ctx"><h4>6 businesses near you</h4></div>{m1}</div><div class="screen sm">{m2}</div><div class="screen sm">{m3}</div></div>
    </figure>
  </div>
</section>"""


today = """<div class="old"><span class="oc"><span class="wr">🔧</span></span><span class="ob"><b>Marula Motorworks</b><span>New</span>
<i>BUSINESS DETAILS CHECKED</i><i>IDENTITY CHECKED</i><i>PREMISES VISITED</i><span>Western Cape</span><span>General service</span></span></div>"""

SPRITE = """<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="s-open" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="currentColor"/></symbol>
<symbol id="s-soon" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 1.4A4.6 4.6 0 0 0 6 10.6Z" fill="currentColor"/></symbol>
<symbol id="s-closed" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.8 9.2 9.2 2.8" stroke="currentColor" stroke-width="1.6"/></symbol>
<symbol id="s-none" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.2 1.8"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></g></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.3-4.3"/></g></symbol>
<symbol id="i-doc" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/></g></symbol>
<symbol id="i-user" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-4 4.2-5.8 7.5-5.8s6.3 1.8 7.5 5.8"/></g></symbol>
<symbol id="i-bay" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-7h10v7"/></g></symbol>
<symbol id="i-car" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-3l2-5h12l2 5v3z"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/></g></symbol>
<symbol id="i-chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
</defs></svg>"""

photo_css = "".join(f".ph{n}{{background-image:url(data:image/jpeg;base64,{photo(n)})}}\n" for n in range(1, 6))

CSS = (pathlib.Path(__file__).parent / "gallery.css").read_text()
JS = (pathlib.Path(__file__).parent / "gallery.js").read_text()

html = f"""<!DOCTYPE html>
<html lang="en-ZA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CarworX listing card options</title>
<style>
@font-face{{font-family:"Geist";src:url(data:font/woff2;base64,{geist}) format("woff2");font-weight:100 900;font-display:swap}}
{CSS}
{photo_css}
</style></head><body>
{SPRITE}
<main>
<section class="intro">
  <div class="it">
    <h1>Listing card: four options</h1>
    <p class="lede">The business's photo fills the top of every card. Underneath: where it is, whether it is open right now, its rating and service, and one compact "Verified" badge in place of the three green pills. Pick a letter.</p>
    <p class="asat">Example businesses and photos. Open status shown as at <b>Saturday 12:35 SAST</b>.</p>
  </div>
  <div class="cmp">
    <figure><figcaption>Today</figcaption>{today}</figure>
    <span class="arr" aria-hidden="true">→</span>
    <figure><figcaption>Option D</figcaption><div class="one">{card_d(CARDS[0])}</div></figure>
  </div>
</section>

<section class="key">
  <h2>Open status: four states, never colour alone</h2>
  <div class="states">
    <div class="sk">{status(CARDS[0])}<p><b>Open</b> more than 60 minutes before closing. Shows today's closing time.</p><span class="cr">Text 6.5:1 on white, 5.7:1 on its strip</span></div>
    <div class="sk">{status(CARDS[1])}<p><b>Closing soon</b> from 60 minutes before closing. Counts down in minutes; the time is in the label.</p><span class="cr">Text 6.3:1 on white, 5.8:1 on its strip</span></div>
    <div class="sk">{status(CARDS[2])}{status(CARDS[3])}<p><b>Closed</b> plus the next opening: "today 14:00", "tomorrow 09:00", or the weekday ("Mon 08:00") further out.</p><span class="cr">Text 7.5:1 on white, 6.6:1 on its strip</span></div>
    <div class="sk">{status(CARDS[4])}<p><b>No hours listed.</b> Grey dashed ring; never guessed as open or closed.</p><span class="cr">Text 6.0:1 on white, 5.2:1 on its strip</span></div>
  </div>
  <p class="note">Each state has its own marker shape (solid dot, half-filled dot, crossed ring, dashed ring) and its own words, so it reads the same in greyscale and for colour-blind visitors. All text meets WCAG AA (4.5:1) on white and on its tinted strip in D.</p>
</section>

{''.join(option(*o) for o in OPTS)}

<section class="spec">
  <div>
    <h2>Shared rules, whichever option you pick</h2>
    <ul>
      <li><b>No photo:</b> the category tint with its CarworX service illustration and the business's initials (Kestrel Glass Fitment above). No emoji.</li>
      <li><b>Verified:</b> one badge with the number of checks. Hover or keyboard focus on desktop, a tap on phones, opens the list of what CarworX checked, worded exactly as today (shown open on the first card of each option). A business with no checks shows no badge.</li>
      <li><b>Location:</b> suburb and town for a fixed workshop; "Serves … and surrounds" for a business that comes to you, which also gets the "Comes to you" tag. Distance can follow the area in search ("Milnerton, Cape Town · 3.2 km").</li>
      <li><b>Times:</b> 24-hour, SAST (Africa/Johannesburg), worked out when the page is served.</li>
      <li><b>Whole card is one link</b> to the business page, as now.</li>
    </ul>
  </div>
  <div>
    <h2>Data the build needs</h2>
    <ul>
      <li><b>Hours in search results.</b> Per-day hours exist (<code>listing_hours</code>, read one listing at a time through <code>api.listing_hours</code>), but the search and category projections don't return them. Add them to the result rows in one query.</li>
      <li><b>An open-status helper.</b> A pure function: hours + now in Africa/Johannesburg → state, closing time, minutes left and next opening (today / tomorrow / weekday). 60-minute threshold. Unit-tested.</li>
      <li><b>Suburb.</b> Listings have only a free-text <code>metro</code> and the full <code>public_address</code>. Needs a public <code>suburb</code> (or locality) field, asked at onboarding and editable.</li>
      <li><b>Public holidays and one-off closures</b> don't exist; until they do, a holiday shows normal hours.</li>
      <li><b>Photo:</b> covered by the existing cover photo (<code>cover_key</code>, D-098). Optional later: a focal point for better cropping.</li>
    </ul>
  </div>
</section>
</main>
<script>{JS}</script>
</body></html>"""

out.write_text(html)
print(out, len(html) // 1024, "KB")
