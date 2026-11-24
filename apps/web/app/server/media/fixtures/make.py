# Regenerates the synthetic cover-photo fixtures (finish-build PR 3):
#   python3 apps/web/app/server/media/fixtures/make.py
# Every image is a synthetic gradient. The metadata is fake on purpose: a
# GPS position in the sea off Cape Point, the comment "SECRET-COMMENT", XMP
# and text chunks reading "SECRET-XMP" / "SECRET-TEXT", so the tests can
# prove none of it survives cleaning.
import io, os
from PIL import Image, PngImagePlugin

HERE = os.path.dirname(os.path.abspath(__file__))
def save(name, data):
    with open(os.path.join(HERE, name), "wb") as f:
        f.write(data)

def gradient(w, h, mode="RGB"):
    im = Image.new("RGB", (w, h))
    im.putdata([((x * 255) // w, (y * 255) // h, 128) for y in range(h) for x in range(w)])
    return im.convert(mode)

exif = Image.Exif()
exif[0x0112] = 6  # Orientation: rotate 90 CW
exif[0x010F] = "SECRET-MAKE"
gps = {1: "S", 2: (34.0, 21.0, 25.0), 3: "E", 4: (18.0, 28.0, 41.0)}
exif[0x8825] = gps
icc = b"\0" * 128 + b"SECRET-ICC"
xmp = b'<x:xmpmeta xmlns:x="adobe:ns:meta/">SECRET-XMP</x:xmpmeta>'

b = io.BytesIO(); gradient(64, 40).save(b, "JPEG", exif=exif, icc_profile=icc, comment=b"SECRET-COMMENT", xmp=xmp, quality=80); save("gps.jpg", b.getvalue())
b = io.BytesIO(); gradient(48, 32).save(b, "JPEG", progressive=True, exif=exif.tobytes(), quality=80); save("progressive.jpg", b.getvalue())
info = PngImagePlugin.PngInfo(); info.add_text("Comment", "SECRET-TEXT"); info.add_itxt("XML:com.adobe.xmp", "SECRET-XMP")
b = io.BytesIO(); gradient(40, 30, "RGBA").save(b, "PNG", pnginfo=info, exif=exif, icc_profile=icc); save("meta.png", b.getvalue())
b = io.BytesIO(); gradient(40, 30, "RGBA").save(b, "WEBP", exif=exif, icc_profile=icc, xmp=xmp, quality=80); save("meta.webp", b.getvalue())
b = io.BytesIO(); gradient(40, 30).save(b, "WEBP", lossless=True); save("lossless.webp", b.getvalue())
frames = [gradient(20, 20), gradient(20, 20).rotate(90)]
b = io.BytesIO(); frames[0].save(b, "PNG", save_all=True, append_images=frames[1:]); save("animated.png", b.getvalue())
b = io.BytesIO(); frames[0].save(b, "WEBP", save_all=True, append_images=frames[1:]); save("animated.webp", b.getvalue())
save("not-an-image.jpg", b"This is a text file pretending to be a photo.\n" * 4)
# Wider than the 6000 px limit (decompression-bomb guard), still a tiny file.
b = io.BytesIO(); Image.new("L", (7001, 1)).save(b, "PNG"); save("too-wide.png", b.getvalue())
# A larger synthetic "photo" for the screenshots (scripts/cover-shots.ts).
im = Image.new("RGB", (1280, 720))
im.putdata([(30 + (x * 120) // 1280, 70 + (y * 110) // 720, 160 + (x * 60) // 1280) for y in range(720) for x in range(1280)])
b = io.BytesIO(); im.save(b, "JPEG", exif=exif, quality=70); save("cover-sample.jpg", b.getvalue())
