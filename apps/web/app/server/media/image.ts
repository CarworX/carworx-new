/**
 * Cover photo cleaning (finish-build PR 3, D-098). Takes untrusted upload
 * bytes and returns a new file that holds only image data, or null.
 *
 * The real type comes from the file's magic bytes, never its name or the
 * browser's Content-Type. The container is rebuilt from an allow-list of
 * image-data parts, so every EXIF, GPS, XMP, ICC, IPTC, comment, text and
 * thumbnail block is dropped, and anything after the image's end marker is
 * cut off. Pixels are copied byte for byte: no decode, so the work is a
 * linear scan that fits the Workers CPU budget (Workers Free; Workers Paid
 * is not approved spend, D-016).
 *
 * One value is carried over on purpose: a JPEG's EXIF Orientation (1-8),
 * written into a fresh, minimal EXIF block, because phone cameras store
 * rotation only there and a portrait photo would otherwise show sideways.
 * Animated images (APNG, animated WebP) are refused.
 */

import { MAX_BYTES, MAX_PIXELS, MAX_SIDE } from "./limits";

// The limits live in ./limits (shared by every photo upload).
export { MAX_BYTES, MAX_PIXELS, MAX_SIDE };

export type ImageType = "image/jpeg" | "image/png" | "image/webp";
export interface CleanImage {
  type: ImageType;
  extension: "jpg" | "png" | "webp";
  bytes: Uint8Array;
  width: number;
  height: number;
}

const u16be = (b: Uint8Array, i: number) =>
  ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u32be = (b: Uint8Array, i: number) =>
  ((b[i] ?? 0) * 0x1000000 +
    ((b[i + 1] ?? 0) << 16) +
    ((b[i + 2] ?? 0) << 8) +
    (b[i + 3] ?? 0)) >>>
  0;
const u24le = (b: Uint8Array, i: number) =>
  (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);
const u32le = (b: Uint8Array, i: number) =>
  (u24le(b, i) + (b[i + 3] ?? 0) * 0x1000000) >>> 0;
const ascii = (b: Uint8Array, i: number, n: number) =>
  String.fromCharCode(...b.subarray(i, i + n));

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function sized(width: number, height: number) {
  return (
    width >= 1 &&
    height >= 1 &&
    width <= MAX_SIDE &&
    height <= MAX_SIDE &&
    width * height <= MAX_PIXELS
  );
}

// ---------------------------------------------------------------------------
// JPEG
// ---------------------------------------------------------------------------
// Kept: SOFn (C0-CF except DHT C4, JPG C8, DAC CC, which are kept as tables),
// DHT, DAC, DQT, DRI, DNL, SOS and its scan data, EOI. Dropped: APP0-APP15
// (JFIF, EXIF/GPS, XMP, ICC, Adobe, IPTC, MPF thumbnails) and COM.
const KEEP_TABLES = new Set([0xc4, 0xcc, 0xdb, 0xdd, 0xdc]);
const isSof = (m: number) =>
  m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;

/** EXIF Orientation from an APP1 segment body, or 1. */
function exifOrientation(body: Uint8Array): number {
  if (ascii(body, 0, 6) !== "Exif\0\0") return 1;
  const t = body.subarray(6);
  const little = ascii(t, 0, 2) === "II";
  if (!little && ascii(t, 0, 2) !== "MM") return 1;
  const r16 = (i: number) =>
    little ? (t[i] ?? 0) | ((t[i + 1] ?? 0) << 8) : u16be(t, i);
  const r32 = (i: number) => (little ? u32le(t, i) : u32be(t, i));
  const ifd = r32(4);
  if (ifd + 2 > t.length) return 1;
  const count = r16(ifd);
  for (let k = 0; k < count && k < 512; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > t.length) return 1;
    if (r16(e) === 0x0112) {
      const v = r16(e + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

/** A minimal big-endian EXIF APP1 holding only Orientation. */
function orientationSegment(value: number): Uint8Array {
  const tiff = [
    0x4d,
    0x4d,
    0,
    42,
    0,
    0,
    0,
    8,
    0,
    1,
    0x01,
    0x12,
    0,
    3,
    0,
    0,
    0,
    1,
    0,
    value,
    0,
    0,
    0,
    0,
    0,
    0,
  ];
  const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const length = body.length + 2;
  return new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff, ...body]);
}

function cleanJpeg(b: Uint8Array): CleanImage | null {
  const parts: Uint8Array[] = [new Uint8Array([0xff, 0xd8])];
  let orientation = 1;
  let width = 0;
  let height = 0;
  let sawScan = false;
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    while (b[i] === 0xff) i++; // fill bytes
    const marker = b[i++] ?? -1;
    if (marker === 0xd9) {
      if (!sawScan || width === 0) return null;
      parts.push(new Uint8Array([0xff, 0xd9])); // anything after EOI is cut
      if (orientation !== 1)
        parts.splice(1, 0, orientationSegment(orientation));
      return {
        type: "image/jpeg",
        extension: "jpg",
        bytes: concat(parts),
        width,
        height,
      };
    }
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    )
      return null;
    if (i + 2 > b.length) return null;
    const length = u16be(b, i);
    if (length < 2 || i + length > b.length) return null;
    const segment = b.subarray(i - 2, i + length);
    const body = b.subarray(i + 2, i + length);
    i += length;
    if (marker === 0xe1) {
      if (orientation === 1) orientation = exifOrientation(body);
      continue;
    }
    if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) continue;
    if (isSof(marker)) {
      if (width !== 0 || body.length < 6) return null; // one frame only
      height = u16be(body, 1);
      width = u16be(body, 3);
      if (!sized(width, height)) return null;
      parts.push(segment);
      continue;
    }
    if (KEEP_TABLES.has(marker)) {
      parts.push(segment);
      continue;
    }
    if (marker !== 0xda) return null; // an unknown marker: refuse, not guess
    if (width === 0) return null;
    // Scan data runs to the next marker that is not a stuffed 00 or RSTn.
    let j = i;
    for (;;) {
      j = b.indexOf(0xff, j);
      if (j < 0 || j + 1 >= b.length) return null;
      const next = b[j + 1] ?? 0;
      if (next === 0x00 || (next >= 0xd0 && next <= 0xd7) || next === 0xff) {
        j += next === 0xff ? 1 : 2;
        continue;
      }
      break;
    }
    parts.push(segment, b.subarray(i, j));
    sawScan = true;
    i = j;
  }
  return null;
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// Image data and colour basics only. Dropped: eXIf, tEXt, zTXt, iTXt, tIME,
// iCCP, pHYs, sPLT, hIST and every private chunk. APNG (acTL) is refused.
const PNG_KEEP = new Set([
  "IHDR",
  "PLTE",
  "tRNS",
  "IDAT",
  "IEND",
  "gAMA",
  "sRGB",
  "cHRM",
  "sBIT",
  "bKGD",
]);

function cleanPng(b: Uint8Array): CleanImage | null {
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let width = 0;
  let height = 0;
  let i = 8;
  let first = true;
  while (i + 12 <= b.length) {
    const length = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    if (!/^[A-Za-z]{4}$/.test(type) || length > b.length - i - 12) return null;
    const chunk = b.subarray(i, i + 12 + length);
    i += 12 + length;
    if (first) {
      if (type !== "IHDR" || length !== 13) return null;
      width = u32be(chunk, 8);
      height = u32be(chunk, 12);
      if (!sized(width, height)) return null;
      first = false;
    } else if (type === "IHDR") return null;
    if (type === "acTL" || type === "fcTL" || type === "fdAT") return null;
    if (type === "IEND") {
      parts.push(chunk); // anything after IEND is cut
      return {
        type: "image/png",
        extension: "png",
        bytes: concat(parts),
        width,
        height,
      };
    }
    if (PNG_KEEP.has(type)) parts.push(chunk);
  }
  return null;
}

// ---------------------------------------------------------------------------
// WebP
// ---------------------------------------------------------------------------
// Kept: VP8, VP8L, ALPH, and VP8X with only its alpha flag. Dropped: ICCP,
// EXIF, XMP and unknown chunks. Animated WebP (ANIM, ANMF) is refused.
function cleanWebp(b: Uint8Array): CleanImage | null {
  const riffSize = u32le(b, 4);
  if (riffSize + 8 > b.length || riffSize < 12) return null;
  const end = riffSize + 8;
  const kept: Uint8Array[] = [];
  let vp8x: Uint8Array | null = null;
  let width = 0;
  let height = 0;
  let image = false;
  let i = 12;
  while (i + 8 <= end) {
    const type = ascii(b, i, 4);
    const size = u32le(b, i + 4);
    const padded = size + (size & 1);
    if (i + 8 + size > end) return null;
    const chunk = b.subarray(i, i + 8 + padded);
    const data = b.subarray(i + 8, i + 8 + size);
    i += 8 + padded;
    if (type === "ANIM" || type === "ANMF") return null;
    if (type === "VP8X") {
      if (vp8x !== null || size < 10) return null;
      vp8x = new Uint8Array(chunk.subarray(0, 18));
      vp8x[8] = (data[0] ?? 0) & 0x10; // keep the alpha flag only
      vp8x[4] = 10;
      vp8x[5] = vp8x[6] = vp8x[7] = 0;
      width = u24le(data, 4) + 1;
      height = u24le(data, 7) + 1;
    } else if (type === "VP8 ") {
      if (
        image ||
        size < 10 ||
        data[3] !== 0x9d ||
        data[4] !== 0x01 ||
        data[5] !== 0x2a
      )
        return null;
      if (vp8x === null) {
        width = ((data[6] ?? 0) | ((data[7] ?? 0) << 8)) & 0x3fff;
        height = ((data[8] ?? 0) | ((data[9] ?? 0) << 8)) & 0x3fff;
      }
      image = true;
      kept.push(chunk);
    } else if (type === "VP8L") {
      if (image || size < 5 || data[0] !== 0x2f) return null;
      if (vp8x === null) {
        const bits = u32le(data, 1);
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
      }
      image = true;
      kept.push(chunk);
    } else if (type === "ALPH") {
      kept.push(chunk);
    }
  }
  if (!image || i !== end || !sized(width, height)) return null;
  const body = concat([...(vp8x === null ? [] : [vp8x]), ...kept]);
  const header = new Uint8Array(12);
  header.set([0x52, 0x49, 0x46, 0x46], 0);
  const total = body.length + 4;
  header.set(
    [
      total & 0xff,
      (total >> 8) & 0xff,
      (total >> 16) & 0xff,
      (total >>> 24) & 0xff,
    ],
    4,
  );
  header.set([0x57, 0x45, 0x42, 0x50], 8);
  return {
    type: "image/webp",
    extension: "webp",
    bytes: concat([header, body]),
    width,
    height,
  };
}

/** Clean an upload, or null if it is not a supported, well-formed still image. */
export function cleanImage(input: Uint8Array): CleanImage | null {
  if (input.length < 16 || input.length > MAX_BYTES) return null;
  try {
    if (input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff)
      return cleanJpeg(input);
    if (PNG_SIGNATURE.every((v, k) => input[k] === v)) return cleanPng(input);
    if (ascii(input, 0, 4) === "RIFF" && ascii(input, 8, 4) === "WEBP")
      return cleanWebp(input);
  } catch {
    return null;
  }
  return null;
}
