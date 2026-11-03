# Route P: SVG text contrast. For each text box from capture.mjs eval=svgtext, sample the background ring
# just outside the box in the captured PNG (scale 2) and compute the WCAG ratio against the computed fill.
#   python -I sample.py <svgtext.json> <pngDir> <out.json>
import sys, json, pymupdf, re, statistics
items = json.load(open(sys.argv[1])); out = []
def lum(c):
    v = [x/255 for x in c]; v = [x/12.92 if x <= .03928 else ((x+.055)/1.055)**2.4 for x in v]
    return .2126*v[0] + .7152*v[1] + .0722*v[2]
pm = {}
for t in items:
    px = pm.setdefault(t['svg'], pymupdf.Pixmap(f"{sys.argv[2]}/41-svg-{t['svg']}.png"))
    fg = [int(x) for x in re.findall(r'[\d.]+', t['fill'])[:3]]
    pts = []
    x0, y0, x1, y1 = [int(v*2) for v in (t['x']-3, t['y']-3, t['x']+t['w']+3, t['y']+t['h']+3)]
    for x in range(x0, x1, 3): pts += [(x, y0), (x, y1)]
    for y in range(y0, y1, 3): pts += [(x0, y), (x1, y)]
    cols = [px.pixel(x, y)[:3] for x, y in pts if 0 <= x < px.width and 0 <= y < px.height]
    ratios = [ (max(lum(fg), lum(c))+.05)/(min(lum(fg), lum(c))+.05) for c in cols ]
    need = 3 if t['px'] >= 24 or (t['px'] >= 18.66 and int(t['weight']) >= 700) else 4.5
    r = round(statistics.median(ratios), 2) if ratios else None
    out.append({**t, 'samples': len(cols), 'medianRatio': r, 'minRatio': round(min(ratios), 2) if ratios else None, 'need': need, 'pass': r is not None and r >= need})
json.dump(out, open(sys.argv[3], 'w'), indent=1)
print(len(out), 'fails', [(o['text'], o['medianRatio']) for o in out if not o['pass']])
