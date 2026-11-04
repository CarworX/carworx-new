# Route C post-check: fail any PNG that is a single colour or has zero size.  python -I check.py <dir>
import sys, os, json, pymupdf
bad = []; n = 0
for f in sorted(os.listdir(sys.argv[1])):
    if not f.endswith('.png'): continue
    n += 1; px = pymupdf.Pixmap(os.path.join(sys.argv[1], f))
    if px.width == 0 or px.height == 0: bad.append([f, 'zero size']); continue
    s = px.samples; st = px.n; first = s[:st]
    if all(s[i:i+st] == first for i in range(0, len(s), st * 97)): bad.append([f, 'single colour'])
print(json.dumps({'checked': n, 'failed': bad}))
