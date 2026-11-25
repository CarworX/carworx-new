# Reduces the screenshots to a 256-colour palette with Floyd-Steinberg
# dithering (keeps gradients and status colours) so the folder stays small.
# Run after shoot.cjs: python3 planning/design/redesign-2026-11/_src/shrink.py [A6]
# Pass the folder prefix you re-shot, so unchanged screens are not re-encoded.
import glob, os, sys
from PIL import Image
root = os.path.join(os.path.dirname(__file__), "..")
prefix = sys.argv[1] if len(sys.argv) > 1 else "A"
for f in glob.glob(os.path.join(root, prefix + "*/png/*.png")):
    im = Image.open(f).convert("RGB")
    pal = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
    im.quantize(palette=pal, dither=Image.Dither.FLOYDSTEINBERG).save(f, optimize=True)
