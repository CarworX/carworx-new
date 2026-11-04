# Route P: SVG text contrast. For each text box from capture.mjs eval=svgtext, sample a ring just outside the box
# in the captured PNG (scale 2) and compute the WCAG ratio of the computed fill against the ring's MODAL colour.
#   python -I sample.py <svgtext.json> <pngDir> <out.json> [marginCssPx=1]
# v2 (C-b, 2026-11-04): margin 3 -> 1 css px and median -> modal colour. With margin 3, the ring around the
# small pin numbers landed outside the 14-unit pin disc (on the map), so white-on-black read as 1.21:1.
# The modal colour is the backdrop the glyph actually sits on; anti-aliased glyph edges are minority samples.
import sys, json, pymupdf, re, collections
items = json.load(open(sys.argv[1])); m = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0; out = []
def lum(c):
    v = [x/255 for x in c]; v = [x/12.92 if x <= .03928 else ((x+.055)/1.055)**2.4 for x in v]
    return .2126*v[0] + .7152*v[1] + .0722*v[2]
def ratio(a, b): la, lb = lum(a), lum(b); return (max(la, lb)+.05)/(min(la, lb)+.05)
pm = {}
for t in items:
    px = pm.setdefault(t['svg'], pymupdf.Pixmap(f"{sys.argv[2]}/41-svg-{t['svg']}.png"))
    fg = [int(x) for x in re.findall(r'[\d.]+', t['fill'])[:3]]
    pts = []
    x0, y0, x1, y1 = [int(round(v*2)) for v in (t['x']-m, t['y']-m, t['x']+t['w']+m, t['y']+t['h']+m)]
    for x in range(x0, x1+1): pts += [(x, y0), (x, y1)]
    for y in range(y0, y1+1): pts += [(x0, y), (x1, y)]
    cols = [tuple(px.pixel(x, y)[:3]) for x, y in pts if 0 <= x < px.width and 0 <= y < px.height]
    mode, n = collections.Counter(cols).most_common(1)[0]
    need = 3 if t['px'] >= 24 or (t['px'] >= 18.66 and int(t['weight']) >= 700) else 4.5
    r = round(ratio(fg, mode), 2)
    out.append({**t, 'marginCss': m, 'samples': len(cols), 'backdrop': 'rgb(%d, %d, %d)' % mode, 'backdropShare': round(n/len(cols), 2),
                'ratio': r, 'need': need, 'pass': r >= need})
json.dump(out, open(sys.argv[3], 'w'), indent=1)
for o in out: print(o['svg'], repr(o['text']), o['backdrop'], o['backdropShare'], o['ratio'], o['need'], 'PASS' if o['pass'] else 'FAIL')
