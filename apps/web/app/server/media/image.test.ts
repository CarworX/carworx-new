import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { cleanImage, MAX_BYTES } from "./image";

// Synthetic fixtures from fixtures/make.py: gradients with fake GPS, comment,
// XMP, ICC and text metadata (all marked SECRET-*).
const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(import.meta.dirname, "fixtures", name)));
const text = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

function exifTags(jpeg: Uint8Array): number[] {
  // Tags in the first IFD of the (only) APP1, big-endian as we write it.
  const at = text(jpeg).indexOf("Exif\0\0");
  if (at < 0) return [];
  const t = jpeg.subarray(at + 6);
  const count = ((t[8] ?? 0) << 8) | (t[9] ?? 0);
  return Array.from(
    { length: count },
    (_, k) => ((t[10 + k * 12] ?? 0) << 8) | (t[11 + k * 12] ?? 0),
  );
}

describe("cover photo cleaning", () => {
  it("strips GPS, maker, comment, XMP and ICC from a JPEG and keeps only orientation", () => {
    const input = fixture("gps.jpg");
    expect(text(input)).toContain("SECRET");
    const out = cleanImage(input);
    expect(out).toMatchObject({
      type: "image/jpeg",
      extension: "jpg",
      width: 64,
      height: 40,
    });
    const bytes = out?.bytes ?? new Uint8Array();
    expect(text(bytes)).not.toContain("SECRET");
    expect(text(bytes)).not.toContain("ICC_PROFILE");
    expect(text(bytes)).not.toContain("http://ns.adobe.com");
    expect(exifTags(bytes)).toEqual([0x0112]); // Orientation only; no GPS (0x8825)
    expect(bytes.at(-2)).toBe(0xff);
    expect(bytes.at(-1)).toBe(0xd9);
  });

  it("keeps every scan of a progressive JPEG", () => {
    const input = fixture("progressive.jpg");
    const out = cleanImage(input);
    expect(out).toMatchObject({ width: 48, height: 32 });
    const scans = (b: Uint8Array) =>
      b.reduce((n, v, i) => n + (v === 0xff && b[i + 1] === 0xda ? 1 : 0), 0);
    expect(scans(out?.bytes ?? new Uint8Array())).toBe(scans(input));
    expect(scans(input)).toBeGreaterThan(1);
  });

  it("cuts anything hidden after the JPEG end marker", () => {
    const input = fixture("gps.jpg");
    const smuggled = new Uint8Array([
      ...input,
      ...new TextEncoder().encode("SECRET-TRAILER"),
    ]);
    const out = cleanImage(smuggled);
    expect(text(out?.bytes ?? new Uint8Array())).not.toContain("SECRET");
  });

  it("drops PNG text, eXIf and iCCP chunks", () => {
    const input = fixture("meta.png");
    expect(text(input)).toMatch(/tEXt|iTXt/);
    const out = cleanImage(input);
    expect(out).toMatchObject({ type: "image/png", width: 40, height: 30 });
    const s = text(out?.bytes ?? new Uint8Array());
    for (const chunk of ["tEXt", "iTXt", "zTXt", "eXIf", "iCCP", "SECRET"])
      expect(s).not.toContain(chunk);
    expect(s).toContain("IHDR");
    expect(s).toContain("IDAT");
    expect(s.endsWith("IEND\xaeB`\x82")).toBe(true);
  });

  it("drops WebP EXIF, XMP and ICCP and fixes the sizes", () => {
    const input = fixture("meta.webp");
    const out = cleanImage(input);
    expect(out).toMatchObject({ type: "image/webp", width: 40, height: 30 });
    const bytes = out?.bytes ?? new Uint8Array();
    const s = text(bytes);
    for (const chunk of ["EXIF", "XMP ", "ICCP", "SECRET"])
      expect(s).not.toContain(chunk);
    const riff =
      (bytes[4] ?? 0) |
      ((bytes[5] ?? 0) << 8) |
      ((bytes[6] ?? 0) << 16) |
      ((bytes[7] ?? 0) << 24);
    expect(riff + 8).toBe(bytes.length);
    expect((bytes[20] ?? 0) & ~0x10).toBe(0); // VP8X flags: alpha at most
  });

  it("accepts a simple lossless WebP", () => {
    expect(cleanImage(fixture("lossless.webp"))).toMatchObject({
      type: "image/webp",
      width: 40,
      height: 30,
    });
  });

  it("refuses animations, fake extensions, truncated files and oversize input", () => {
    expect(cleanImage(fixture("animated.png"))).toBeNull();
    expect(cleanImage(fixture("animated.webp"))).toBeNull();
    expect(cleanImage(fixture("not-an-image.jpg"))).toBeNull();
    expect(cleanImage(fixture("too-wide.png"))).toBeNull(); // over 6000 px
    const jpeg = fixture("gps.jpg");
    expect(cleanImage(jpeg.subarray(0, jpeg.length - 40))).toBeNull();
    expect(cleanImage(fixture("meta.png").subarray(0, 60))).toBeNull();
    expect(cleanImage(new Uint8Array(MAX_BYTES + 1))).toBeNull();
    expect(cleanImage(new Uint8Array(0))).toBeNull();
  });
});
