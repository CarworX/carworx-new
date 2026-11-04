// WCAG 2.2 contrast, with alpha compositing for Studio's translucent layers
// (frost, hair, dot). Pure and import-free: used by the unit tests, the
// `contrast` CLI, the living page and the browser audit.

export type RGBA = [number, number, number, number];

export function parseColor(value: string): RGBA {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{6})$/.exec(v);
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const fn =
    /^rgba?\(\s*([\d.]+)\s*,?\s*([\d.]+)\s*,?\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/.exec(
      v,
    );
  if (fn) {
    const a =
      fn[4] === undefined
        ? 1
        : fn[4].endsWith("%")
          ? parseFloat(fn[4]) / 100
          : parseFloat(fn[4]);
    return [Number(fn[1]), Number(fn[2]), Number(fn[3]), a];
  }
  throw new Error(`Unsupported colour: ${value}`);
}

/** Paints `top` over an opaque `bottom` (source-over). */
export function over(top: RGBA, bottom: RGBA): RGBA {
  const a = top[3];
  return [
    top[0] * a + bottom[0] * (1 - a),
    top[1] * a + bottom[1] * (1 - a),
    top[2] * a + bottom[2] * (1 - a),
    1,
  ];
}

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
export const luminance = ([r, g, b]: RGBA) =>
  0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

export function ratio(fg: RGBA, bg: RGBA): number {
  const back = bg[3] < 1 ? over(bg, [255, 255, 255, 1]) : bg;
  const front = fg[3] < 1 ? over(fg, back) : fg;
  const a = luminance(front);
  const b = luminance(back);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** WCAG floors: body text 4.5, large text (≥ 24 px, or ≥ 18.66 px bold) and UI graphics 3. */
export const FLOOR = { text: 4.5, large: 3, ui: 3 } as const;
export type Kind = keyof typeof FLOOR;

export interface Pair {
  /** Where it appears, e.g. "404 · headline". */
  where: string;
  /** Token names (or literal colours) for the foreground and its ground. */
  fg: string;
  bg: string;
  /** A translucent layer between bg and fg, e.g. frost over canvas. */
  via?: string;
  kind: Kind;
}

export interface Measured extends Pair {
  ratio: number;
  floor: number;
  pass: boolean;
}

export function measure(
  pairs: readonly Pair[],
  colors: Readonly<Record<string, string>>,
): Measured[] {
  const col = (name: string) => {
    const v =
      name.startsWith("#") || name.startsWith("rgb") ? name : colors[name];
    if (v === undefined) throw new Error(`Unknown colour token: ${name}`);
    return parseColor(v);
  };
  return pairs.map((p) => {
    let ground = col(p.bg);
    if (ground[3] < 1)
      throw new Error(`${p.where}: the ground ${p.bg} must be opaque`);
    if (p.via) ground = over(col(p.via), ground);
    const r = ratio(col(p.fg), ground);
    const floor = FLOOR[p.kind];
    return { ...p, ratio: Math.round(r * 100) / 100, floor, pass: r >= floor };
  });
}
