# Usage: python3 apps/web/scripts/home-port/port.py <preview dist dir> apps/web
# The preview dist is planning/sites-customer-preview/dist on #83 @ b88a8ca.
# Port the approved Sites preview home (#83 @ b88a8ca) into apps/web verbatim,
# applying only the owner's edits. Re-run to regenerate from the preview.
import re, sys, os, shutil
P, OUT = sys.argv[1], sys.argv[2]
h = open(f"{P}/index.html", encoding="utf-8").read()
styles = re.findall(r"<style[^>]*>(.*?)</style>", h, flags=re.S)
script = re.findall(r"<script>(.*?)</script>", h, flags=re.S)[0]
body = h[h.index("<body") :]
body = body[body.index(">") + 1 : body.index("<script>")]
edits = []
def sub(old, new, count=1):
    global body
    n = body.count(old)
    if n < count or (count == 1 and n != 1):
        raise SystemExit(f"expected {count} of {old[:70]!r}, found {n}")
    body = body.replace(old, new) if count != 1 else body.replace(old, new, 1)
# 1. The Sites hosting band is not part of the page.
band = re.search(r'<div style="background:#1c2128[^>]*>.*?</div>\s*', body, flags=re.S)
body = body[: band.start()] + body[band.end() :]
# 2. Real routes.
sub('href="/app.html#search/wash"><span class="k-obj"', 'href="/c/wash-and-detailing"><span class="k-obj"')
sub('href="/app.html#search/repairs"', 'href="/c/repairs-and-maintenance"')
sub('href="/app.html#search/glass"', 'href="/c/glass-repair-and-replacement"')
sub('href="/app.html#search/tyres"', 'href="/c/tyres-and-wheel-alignment"')
sub('href="/app.html#fines"', 'href="/fines"')
body = body.replace('href="/app.html#search/wash"', 'href="/search"')
body = body.replace('href="/onboarding/phase1/index.html"', 'href="/provider/get-listed/business"')
assert "/app.html" not in body and "/onboarding/" not in body and "/progress.html" not in body
# 3. Sign in / Sign up: desktop header and the menu sheet.
m = re.search(r'<a href="/provider/get-listed/business" class="pill light">\s*<span>List your business</span>\s*(<span class="arr" aria-hidden="true">.*?</span>)\s*</a>', body, flags=re.S)
arr = m.group(1)
body = body[: m.start()] + (
    '<div class="acct"><a class="signin" href="/auth/sign-in">Sign in</a>'
    f'<a class="pill" href="/auth/sign-up"><span>Sign up</span>{arr}</a></div>'
) + body[m.end() :]
sub('<div class="acts">', '<div class="acts">\n    <div class="acct-row"><a class="pill light" href="/auth/sign-in"><span>Sign in</span></a><a class="pill" href="/auth/sign-up"><span>Sign up</span></a></div>')
# 4. No demo, fictional or concept wording.
sub("Rosebank · ★ 4.8 (fictional) · Wash", "Rosebank · ★ 4.8 · Wash")
body = re.sub(r'\s*<div><span class="badge tag"><i></i>Concept, not final</span></div>', "", body)
sub("<span>Studio direction, pass 1 · All businesses, people, prices and ratings are fictional.</span>",
    '<span><a href="/support">Contact support</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms of use</a></span>')
low = re.sub(r"<[^>]+>", " ", body).lower()
for w in ["fictional", "demo", "concept", "prototype", "private preview", "mock"]:
    assert w not in low, w
os.makedirs(f"{OUT}/app/home", exist_ok=True)
os.makedirs(f"{OUT}/public/home", exist_ok=True)
os.makedirs(f"{OUT}/public/fonts", exist_ok=True)
head = ("<!-- GENERATED from planning/sites-customer-preview/dist/index.html on #83 @ b88a8ca\n"
        "     by the owner-approved port (Sites preview home, verbatim). Edits: no hosting band,\n"
        "     real routes, Sign in / Sign up, no demo wording. Do not hand-edit. -->\n")
open(f"{OUT}/app/home/preview.html", "w", encoding="utf-8").write(head + body.strip() + "\n")
css = "\n".join(styles)
extra = """
/* ---- apps/web additions (not in the preview) ---- */
.nav .acct{display:flex;align-items:center;gap:var(--s2)}
.nav .signin{display:inline-flex;align-items:center;height:48px;padding:0 12px;font-size:14px;font-weight:500;color:var(--ink);border-radius:999px}
.nav .signin:hover{background:rgba(13,15,18,.05)}
.sheet .acct-row{display:grid;grid-template-columns:1fr 1fr;gap:var(--s1);padding-bottom:var(--s1);margin-bottom:var(--s1);border-bottom:1px solid var(--hair)}
.sheet .acct-row .pill{justify-content:center;padding:0 16px}
footer .fine a{color:inherit;text-decoration:underline;text-underline-offset:3px}
@media (max-width:900px){.nav .acct{display:none}}
"""
open(f"{OUT}/app/home/home.css", "w", encoding="utf-8").write(
    "/* GENERATED from the Sites preview home (#83 @ b88a8ca). Loaded on / only. */\n" + css + extra)
open(f"{OUT}/public/home/home.js", "w", encoding="utf-8").write(
    "// GENERATED from the Sites preview home (#83 @ b88a8ca), verbatim.\n" + script.strip() + "\n")
for f in ["Geist-latin.woff2", "GeistMono-latin.woff2", "Caveat-latin.woff2"]:
    shutil.copy(f"{P}/fonts/{f}", f"{OUT}/public/fonts/{f}")
print("ok", len(body), len(css), len(script))
