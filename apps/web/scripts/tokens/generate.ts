// Studio token generator (T4, issue #8).
//
// Turns planning/design/brand/tokens.json (v4, the design source of truth,
// D-040) into the app's Tailwind v4 theme and CSS variables, and the Turbine
// mark's exported SVG paths into a TypeScript module for the canvas loaders.
// Pure functions only: the CLI (cli.ts) does the file I/O and the check mode.

export interface TokenEntry {
  name: string;
  value: string;
  usage?: string;
}
export interface FontFace {
  family: string;
  file: string;
  weight: string;
  style: string;
}
export interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
}
export interface TypeGroup {
  name: string;
  family: string;
  styles: TypeStyle[];
}
export interface TokensV4 {
  name: string;
  version: number;
  color: { tokens: TokenEntry[] };
  type: {
    fonts: FontFace[];
    families: Record<string, string>;
    groups: TypeGroup[];
  };
  spacing: { tokens: TokenEntry[] };
  radius: { tokens: TokenEntry[] };
  shadow: { tokens: TokenEntry[] };
  blur: { tokens: TokenEntry[] };
}

// The Latin subset the self-hosted fonts were cut to (app/styles/fonts/README.md).
export const LATIN_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-f]{6}$/;
const RGBA = /^rgba\(\d{1,3},\d{1,3},\d{1,3},(?:0|1|0?\.\d+)\)$/;
const PX = /^\d+(?:\.\d+)?px$/;
const EM = /^-?\d*\.?\d+em$/;
const SAFE = /^[^;{}<>\\]+$/;

export class TokenError extends Error {}

function fail(message: string): never {
  throw new TokenError(`tokens.json: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function entries(value: unknown, where: string): TokenEntry[] {
  if (!isRecord(value) || !Array.isArray(value["tokens"]))
    fail(`${where}.tokens must be an array`);
  const seen = new Set<string>();
  return (value["tokens"] as unknown[]).map((raw, i) => {
    if (!isRecord(raw)) fail(`${where}.tokens[${String(i)}] is not an object`);
    const { name, value: v, usage } = raw;
    if (typeof name !== "string" || !NAME.test(name))
      fail(`${where}.tokens[${String(i)}].name is not a token name`);
    if (typeof v !== "string" || !SAFE.test(v))
      fail(`${where}.${name} has an unsafe or missing value`);
    if (seen.has(name)) fail(`${where}.${name} is duplicated`);
    seen.add(name);
    return { name, value: v, ...(typeof usage === "string" ? { usage } : {}) };
  });
}

// Validates the parsed JSON and returns it typed. Throws TokenError with a
// precise message on anything the generator would otherwise emit wrongly.
export function parseTokens(json: unknown): TokensV4 {
  if (!isRecord(json)) fail("root is not an object");
  if (json["version"] !== 4)
    fail(`version must be 4, got ${String(json["version"])}`);
  const color = entries(json["color"], "color");
  for (const c of color)
    if (!HEX.test(c.value) && !RGBA.test(c.value))
      fail(`color.${c.name} must be #rrggbb or rgba(r,g,b,a), got ${c.value}`);
  const spacing = entries(json["spacing"], "spacing");
  for (const s of spacing) {
    if (!s.name.startsWith("space-"))
      fail(`spacing.${s.name} must start with space-`);
    if (!PX.test(s.value)) fail(`spacing.${s.name} must be px`);
  }
  const radius = entries(json["radius"], "radius");
  for (const r of radius)
    if (!r.name.startsWith("radius-"))
      fail(`radius.${r.name} must start with radius-`);
  const shadow = entries(json["shadow"], "shadow");
  for (const s of shadow)
    if (!s.name.startsWith("sh-")) fail(`shadow.${s.name} must start with sh-`);
  const blur = entries(json["blur"], "blur");
  for (const b of blur) {
    if (!b.name.startsWith("blur-"))
      fail(`blur.${b.name} must start with blur-`);
    if (!PX.test(b.value)) fail(`blur.${b.name} must be px`);
  }

  const type = json["type"];
  if (!isRecord(type)) fail("type is missing");
  const families = type["families"];
  if (!isRecord(families)) fail("type.families is missing");
  const fam: Record<string, string> = {};
  for (const [k, v] of Object.entries(families)) {
    if (!NAME.test(k) || typeof v !== "string" || !SAFE.test(v))
      fail(`type.families.${k} is invalid`);
    fam[k] = v;
  }
  if (!Array.isArray(type["fonts"])) fail("type.fonts must be an array");
  const fonts = (type["fonts"] as unknown[]).map((raw, i): FontFace => {
    if (!isRecord(raw)) fail(`type.fonts[${String(i)}] is not an object`);
    const { family, file, weight, style } = raw;
    if (
      typeof family !== "string" ||
      typeof file !== "string" ||
      typeof weight !== "string" ||
      typeof style !== "string" ||
      !/^[A-Za-z ]+$/.test(family) ||
      !/^fonts\/[A-Za-z0-9-]+\.woff2$/.test(file) ||
      !/^\d{3}(?: \d{3})?$/.test(weight) ||
      !/^(?:normal|italic)$/.test(style)
    )
      fail(`type.fonts[${String(i)}] is invalid`);
    return { family, file, weight, style };
  });
  if (!Array.isArray(type["groups"])) fail("type.groups must be an array");
  const seen = new Set<string>();
  const groups = (type["groups"] as unknown[]).map((raw, i): TypeGroup => {
    if (!isRecord(raw) || typeof raw["name"] !== "string")
      fail(`type.groups[${String(i)}] is invalid`);
    const family = raw["family"];
    if (typeof family !== "string" || !(family in fam))
      fail(`type.groups[${String(i)}].family is not a declared family`);
    if (!Array.isArray(raw["styles"]))
      fail(`type.groups[${String(i)}].styles is missing`);
    const styles = (raw["styles"] as unknown[]).map((s, j): TypeStyle => {
      const at = `type.groups[${String(i)}].styles[${String(j)}]`;
      if (!isRecord(s)) fail(`${at} is not an object`);
      const { name, fontSize, lineHeight, fontWeight, letterSpacing } = s;
      if (typeof name !== "string" || !NAME.test(name))
        fail(`${at}.name is invalid`);
      if (seen.has(name)) fail(`type style ${name} is duplicated`);
      seen.add(name);
      if (typeof fontSize !== "string" || !PX.test(fontSize))
        fail(`${name}.fontSize must be px`);
      if (typeof lineHeight !== "string" || !PX.test(lineHeight))
        fail(`${name}.lineHeight must be px`);
      if (
        typeof fontWeight !== "number" ||
        fontWeight < 100 ||
        fontWeight > 900
      )
        fail(`${name}.fontWeight is invalid`);
      if (
        letterSpacing !== undefined &&
        (typeof letterSpacing !== "string" || !EM.test(letterSpacing))
      )
        fail(`${name}.letterSpacing must be em`);
      return {
        name,
        fontSize,
        lineHeight,
        fontWeight,
        ...(typeof letterSpacing === "string" ? { letterSpacing } : {}),
      };
    });
    return { name: raw["name"], family, styles };
  });

  return {
    name: typeof json["name"] === "string" ? json["name"] : "CarworX",
    version: 4,
    color: { tokens: color },
    type: { fonts, families: fam, groups },
    spacing: { tokens: spacing },
    radius: { tokens: radius },
    shadow: { tokens: shadow },
    blur: { tokens: blur },
  };
}

const strip = (name: string, prefix: string) => name.slice(prefix.length);

// The generated stylesheet. Tailwind's own palette, fonts, radii, shadows and
// type scale are cleared first, so only Studio values exist as utilities
// (bg-ink, text-muted, rounded-pill, shadow-2, text-body, font-mono, …).
// `static` keeps every variable in the output even when no utility uses it,
// because the cx- component styles read them with var().
export function generateTokensCss(
  t: TokensV4,
  source: { path: string; sha256: string },
): string {
  const out: string[] = [];
  const line = (s: string) => out.push(s);
  line(
    `/* GENERATED from ${source.path} (v${String(t.version)}, sha256 ${source.sha256}).`,
  );
  line(
    " * Do not edit. Run `pnpm --filter @carworx/web tokens` to regenerate;",
  );
  line(" * the unit tests and `tokens:check` fail when this file is stale. */");
  line("");
  for (const f of t.type.fonts) {
    line("@font-face {");
    line(`  font-family: "${f.family}";`);
    line(`  src: url("./${f.file}") format("woff2");`);
    line(`  font-weight: ${f.weight};`);
    line(`  font-style: ${f.style};`);
    line("  font-display: swap;");
    line(`  unicode-range: ${LATIN_RANGE};`);
    line("}");
  }
  line("");
  line("@theme static {");
  line("  --color-*: initial;");
  for (const c of t.color.tokens) line(`  --color-${c.name}: ${c.value};`);
  line("  --font-*: initial;");
  for (const [k, v] of Object.entries(t.type.families))
    line(`  --font-${k}: ${v};`);
  line("  --text-*: initial;");
  for (const g of t.type.groups)
    for (const s of g.styles) {
      line(`  --text-${s.name}: ${s.fontSize};`);
      line(`  --text-${s.name}--line-height: ${s.lineHeight};`);
      line(`  --text-${s.name}--font-weight: ${String(s.fontWeight)};`);
      if (s.letterSpacing)
        line(`  --text-${s.name}--letter-spacing: ${s.letterSpacing};`);
    }
  for (const s of t.spacing.tokens)
    line(`  --spacing-${strip(s.name, "space-")}: ${s.value};`);
  line("  --radius-*: initial;");
  for (const r of t.radius.tokens)
    line(`  --radius-${strip(r.name, "radius-")}: ${r.value};`);
  line("  --shadow-*: initial;");
  for (const s of t.shadow.tokens)
    line(`  --shadow-${strip(s.name, "sh-")}: ${s.value};`);
  line("  --blur-*: initial;");
  for (const b of t.blur.tokens)
    line(`  --blur-${strip(b.name, "blur-")}: ${b.value};`);
  line("}");
  line("");
  line(
    "/* Studio names, as in brand/studio/tokens.css, for the cx- component styles. */",
  );
  line(":root {");
  for (const c of t.color.tokens)
    line(`  --${c.name}: var(--color-${c.name});`);
  for (const s of t.spacing.tokens)
    line(`  --${s.name}: var(--spacing-${strip(s.name, "space-")});`);
  for (const s of t.shadow.tokens)
    line(`  --${s.name}: var(--shadow-${strip(s.name, "sh-")});`);
  line("}");
  line("");
  line(
    "/* One utility per type style: family, size, line height, weight, tracking. */",
  );
  for (const g of t.type.groups)
    for (const s of g.styles) {
      line(`@utility type-${s.name} {`);
      line(`  font-family: var(--font-${g.family});`);
      line(`  font-size: var(--text-${s.name});`);
      line(`  line-height: var(--text-${s.name}--line-height);`);
      line(`  font-weight: var(--text-${s.name}--font-weight);`);
      line(
        `  letter-spacing: ${s.letterSpacing ? `var(--text-${s.name}--letter-spacing)` : "0"};`,
      );
      line("}");
    }
  return out.join("\n") + "\n";
}

// ---- the Turbine mark ----------------------------------------------------

export interface MarkSource {
  full: string; // carworx-mark-ink.svg
  small: string; // carworx-mark-small-ink.svg
  lockup: string; // carworx-lockup-horizontal-ink.svg
}
export interface MarkData {
  blade: string;
  bladeSmall: string;
  rest: number;
  restSmall: number;
  lockupViewBox: string;
  lockupMark: string;
  lockupWord: string;
  word: string[];
}

const pathDs = (svg: string) =>
  [...svg.matchAll(/<path([^>]*?) d="([^"]+)"/g)].map((m) => ({
    attrs: m[1] ?? "",
    d: m[2] ?? "",
  }));

function oneMark(svg: string, which: string): { d: string; rest: number } {
  const ps = pathDs(svg);
  const first = ps[0];
  if (ps.length !== 5 || !first)
    throw new TokenError(`${which}: expected 5 blades`);
  ps.forEach((p, i) => {
    if (p.d !== first.d) throw new TokenError(`${which}: blades differ`);
    if (!p.attrs.includes(`rotate(${String(i * 72)})`))
      throw new TokenError(
        `${which}: blade ${String(i)} is not at ${String(i * 72)}°`,
      );
  });
  const g =
    /<g transform="translate\(100,100\) scale\(1\) rotate\((-?[\d.]+)\)"/.exec(
      svg,
    );
  if (!g?.[1]) throw new TokenError(`${which}: rest angle not found`);
  if (!/^[MLCQZHVSA0-9 .,-]+$/i.test(first.d))
    throw new TokenError(`${which}: unexpected path data`);
  return { d: first.d, rest: Number(g[1]) };
}

// Same checks as the states build (planning/design/concepts/states/build.mjs):
// the blade is taken from the exported logo, never redrawn.
export function parseMark(src: MarkSource): MarkData {
  const full = oneMark(src.full, "carworx-mark-ink.svg");
  const small = oneMark(src.small, "carworx-mark-small-ink.svg");
  const ps = pathDs(src.lockup);
  if (ps.length !== 12 || ps.slice(0, 5).some((p) => p.d !== full.d))
    throw new TokenError("lockup: blades differ from the mark");
  const vb = /viewBox="([^"]+)"/.exec(src.lockup)?.[1];
  const groups = [...src.lockup.matchAll(/<g transform="([^"]+)"/g)].map(
    (m) => m[1] ?? "",
  );
  if (!vb || groups.length < 2)
    throw new TokenError("lockup: viewBox or groups missing");
  return {
    blade: full.d,
    bladeSmall: small.d,
    rest: full.rest,
    restSmall: small.rest,
    lockupViewBox: vb,
    lockupMark: groups[0] ?? "",
    lockupWord: groups[1] ?? "",
    word: ps.slice(5).map((p) => p.d),
  };
}

export function generateMarkTs(m: MarkData, sha256: string): string {
  return [
    `// GENERATED from planning/design/brand/exports/core (sha256 ${sha256}).`,
    "// Do not edit. Run `pnpm --filter @carworx/web tokens` to regenerate.",
    "",
    "/** One blade of the full mark (48 px and up), in mark units (tip radius 100). */",
    `export const BLADE = ${JSON.stringify(m.blade)};`,
    "/** One blade of the small mark (16–47 px). */",
    `export const BLADE_SMALL = ${JSON.stringify(m.bladeSmall)};`,
    "/** Rest angles in degrees: the rotation at which the mark is the logo. */",
    `export const REST = ${String(m.rest)};`,
    `export const REST_SMALL = ${String(m.restSmall)};`,
    "/** Horizontal lockup geometry, for the inline logo. */",
    `export const LOCKUP_VIEWBOX = ${JSON.stringify(m.lockupViewBox)};`,
    `export const LOCKUP_MARK_TRANSFORM = ${JSON.stringify(m.lockupMark)};`,
    `export const LOCKUP_WORD_TRANSFORM = ${JSON.stringify(m.lockupWord)};`,
    `export const WORDMARK: readonly string[] = ${JSON.stringify(m.word)};`,
    "",
  ].join("\n");
}

// ---- UI glyphs (brand/exports/studio/icons) ------------------------------

export type IconNode =
  | ["path", { d: string; fill?: "currentColor"; stroke?: "none" }]
  | ["circle", { cx: number; cy: number; r: number }]
  | [
      "rect",
      { x: number; y: number; width: number; height: number; rx?: number },
    ];

const ATTR = /([a-z-]+)="([^"]*)"/g;
const attrs = (s: string) =>
  Object.fromEntries(
    [...s.matchAll(ATTR)].map((m) => [m[1] ?? "", m[2] ?? ""]),
  );
const num = (v: string | undefined, at: string): number => {
  if (v === undefined || !/^-?\d*\.?\d+$/.test(v))
    throw new TokenError(`${at}: bad number ${String(v)}`);
  return Number(v);
};
const GLYPH_G =
  '<g fill="none" stroke="#0d0f12" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';

// Every glyph is a 24-unit, 1.8-stroke drawing in one group; colour becomes
// currentColor so icons take the text colour, as the cx-ic masks do.
export function parseIcon(name: string, svg: string): IconNode[] {
  if (!svg.includes('viewBox="0 0 24 24"') || !svg.includes(GLYPH_G))
    throw new TokenError(`icon ${name}: not a 24-unit Studio glyph`);
  const body = svg.slice(
    svg.indexOf(GLYPH_G) + GLYPH_G.length,
    svg.lastIndexOf("</g>"),
  );
  const nodes: IconNode[] = [];
  for (const m of body.matchAll(/<(path|circle|rect)\s([^>]*?)\/>/g)) {
    const a = attrs(m[2] ?? "");
    const at = `icon ${name}`;
    if (m[1] === "path") {
      const d = a["d"];
      if (!d || !/^[MLHVCSQTAZmlhvcsqtaz0-9 .,-]+$/.test(d))
        throw new TokenError(`${at}: bad path`);
      nodes.push([
        "path",
        {
          d,
          ...(a["fill"] ? { fill: "currentColor" as const } : {}),
          ...(a["stroke"] === "none" ? { stroke: "none" as const } : {}),
        },
      ]);
    } else if (m[1] === "circle") {
      nodes.push([
        "circle",
        { cx: num(a["cx"], at), cy: num(a["cy"], at), r: num(a["r"], at) },
      ]);
    } else {
      nodes.push([
        "rect",
        {
          x: num(a["x"], at),
          y: num(a["y"], at),
          width: num(a["width"], at),
          height: num(a["height"], at),
          ...(a["rx"] ? { rx: num(a["rx"], at) } : {}),
        },
      ]);
    }
  }
  if (
    nodes.length === 0 ||
    body.replace(/<(path|circle|rect)\s[^>]*?\/>/g, "").trim() !== ""
  )
    throw new TokenError(`icon ${name}: unexpected markup`);
  return nodes;
}

export function generateIconsTs(
  icons: [string, IconNode[]][],
  sha256: string,
): string {
  const names = icons.map(([n]) => n);
  return [
    `// GENERATED from planning/design/brand/exports/studio/icons (sha256 ${sha256}).`,
    "// Do not edit. Run `pnpm --filter @carworx/web tokens` to regenerate.",
    "",
    `export const ICON_NAMES = ${JSON.stringify(names)} as const;`,
    "export type IconName = (typeof ICON_NAMES)[number];",
    "export type IconNode =",
    '  | ["path", { d: string; fill?: "currentColor"; stroke?: "none" }]',
    '  | ["circle", { cx: number; cy: number; r: number }]',
    '  | ["rect", { x: number; y: number; width: number; height: number; rx?: number }];',
    "",
    `export const ICONS: Record<IconName, readonly IconNode[]> = ${JSON.stringify(Object.fromEntries(icons))};`,
    "",
  ].join("\n");
}
