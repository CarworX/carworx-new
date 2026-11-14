/**
 * A very small PDF 1.4 writer for CarworX documents (planning/claude/25 §3a).
 *
 * Why our own and not a library: the documents are one or two A4 pages of
 * text, rules and filled boxes, so the standard PDF fonts (Helvetica and
 * Courier, which every reader has built in) are enough. That keeps the
 * Worker bundle small, adds no dependency or third-party service, and makes
 * the output deterministic: content streams are left uncompressed, so tests
 * can read the words on the page.
 *
 * Pure: no I/O, no clock, no logging.
 */

export const A4 = { width: 595.28, height: 841.89 };

export type Font = "sans" | "bold" | "mono" | "monoBold";
export type Rgb = readonly [number, number, number];

const FONT_NAMES: Record<Font, string> = {
  sans: "Helvetica",
  bold: "Helvetica-Bold",
  mono: "Courier",
  monoBold: "Courier-Bold",
};
const FONT_KEYS: Record<Font, string> = {
  sans: "F1",
  bold: "F2",
  mono: "F3",
  monoBold: "F4",
};

/** "#0d0f12" to PDF's 0–1 colour components. */
export function hex(value: string): Rgb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (m === null) throw new Error("pdf_colour");
  return [
    parseInt(m[1] ?? "0", 16) / 255,
    parseInt(m[2] ?? "0", 16) / 255,
    parseInt(m[3] ?? "0", 16) / 255,
  ];
}

// Helvetica advance widths (1/1000 em) for ASCII 32–126, from the standard
// Adobe font metrics. Bold is a little wider; widthOf() allows for it.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];

// WinAnsiEncoding bytes for the few characters above U+00FF we print.
const WIN_ANSI: Record<string, number> = {
  "€": 128,
  "…": 133,
  "‘": 145,
  "’": 146,
  "“": 147,
  "”": 148,
  "•": 149,
  "–": 150,
  "—": 151,
};

/**
 * Text as WinAnsi bytes (one char per byte). Latin-1 letters keep their
 * code; the minus sign becomes a hyphen; anything the standard fonts can't
 * draw becomes "?", never a broken byte sequence.
 */
export function winAnsi(text: string): string {
  let out = "";
  for (const c of text) {
    const code = c.codePointAt(0) ?? 63;
    if (c === "−") out += "-";
    else if (code >= 32 && code <= 126) out += c;
    else if (code >= 160 && code <= 255) out += c;
    else if (WIN_ANSI[c] !== undefined) out += String.fromCharCode(WIN_ANSI[c]);
    else out += "?";
  }
  return out;
}

/** Width in points of text set in a font at a size. */
export function widthOf(text: string, font: Font, size: number): number {
  const bytes = winAnsi(text);
  if (font === "mono" || font === "monoBold") return bytes.length * 0.6 * size;
  let units = 0;
  for (const ch of bytes) {
    const code = ch.charCodeAt(0);
    units += code >= 32 && code <= 126 ? (HELVETICA[code - 32] ?? 556) : 556;
  }
  return (units / 1000) * size * (font === "bold" ? 1.06 : 1);
}

/** Greedy word wrap to a width; a word longer than the line is cut. */
export function wrap(
  text: string,
  font: Font,
  size: number,
  width: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter((w) => w !== "")) {
    let w = word;
    while (widthOf(w, font, size) > width) {
      let cut = w.length - 1;
      while (cut > 1 && widthOf(w.slice(0, cut), font, size) > width) cut--;
      if (line !== "") {
        lines.push(line);
        line = "";
      }
      lines.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    const next = line === "" ? w : `${line} ${w}`;
    if (widthOf(next, font, size) <= width) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

function literal(text: string): string {
  let out = "(";
  for (const ch of winAnsi(text)) {
    const code = ch.charCodeAt(0);
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`;
    else if (code > 126) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += ch;
  }
  return `${out})`;
}

const n = (v: number): string => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};
const rgb = (c: Rgb): string => c.map(n).join(" ");

/** One page's drawing operations. y is measured from the top of the page. */
export class Page {
  readonly ops: string[] = [];

  rect(x: number, y: number, w: number, h: number, fill: Rgb): void {
    this.ops.push(
      `${rgb(fill)} rg ${n(x)} ${n(A4.height - y - h)} ${n(w)} ${n(h)} re f`,
    );
  }

  line(
    x1: number,
    y: number,
    x2: number,
    colour: Rgb,
    opts: { width?: number; dash?: boolean } = {},
  ): void {
    const dash = opts.dash === true ? "[3 3] 0 d" : "[] 0 d";
    const py = n(A4.height - y);
    this.ops.push(
      `${rgb(colour)} RG ${n(opts.width ?? 0.75)} w ${dash} ${n(x1)} ${py} m ${n(x2)} ${py} l S`,
    );
  }

  /** Text with its baseline at y. align right puts its end at x. */
  text(
    x: number,
    y: number,
    value: string,
    font: Font,
    size: number,
    colour: Rgb,
    align: "left" | "right" = "left",
  ): void {
    const left = align === "right" ? x - widthOf(value, font, size) : x;
    this.ops.push(
      `BT ${rgb(colour)} rg /${FONT_KEYS[font]} ${n(size)} Tf ${n(left)} ${n(A4.height - y)} Td ${literal(value)} Tj ET`,
    );
  }
}

export interface DocumentInfo {
  title: string;
  author: string;
}

/** Serialise pages into a PDF file. No dates, so output is reproducible. */
export function writePdf(
  pages: Page[],
  info: DocumentInfo,
): Uint8Array<ArrayBuffer> {
  if (pages.length === 0) throw new Error("pdf_empty");
  const objects: string[] = [];
  const add = (body: string): number => {
    objects.push(body);
    return objects.length;
  };
  const catalog = add(""); // filled once the page tree number is known
  const tree = add("");
  const fonts = (Object.keys(FONT_NAMES) as Font[]).map((f) =>
    add(
      `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_NAMES[f]} /Encoding /WinAnsiEncoding >>`,
    ),
  );
  const fontDict = (Object.keys(FONT_NAMES) as Font[])
    .map((f, i) => `/${FONT_KEYS[f]} ${String(fonts[i] ?? 0)} 0 R`)
    .join(" ");
  const kids: number[] = [];
  for (const page of pages) {
    const stream = page.ops.join("\n");
    const content = add(
      `<< /Length ${String(stream.length)} >>\nstream\n${stream}\nendstream`,
    );
    kids.push(
      add(
        `<< /Type /Page /Parent ${String(tree)} 0 R /MediaBox [0 0 ${n(A4.width)} ${n(A4.height)}] /Resources << /Font << ${fontDict} >> >> /Contents ${String(content)} 0 R >>`,
      ),
    );
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${String(tree)} 0 R >>`;
  objects[tree - 1] =
    `<< /Type /Pages /Kids [${kids.map((k) => `${String(k)} 0 R`).join(" ")}] /Count ${String(kids.length)} >>`;
  const infoObj = add(
    `<< /Title ${literal(info.title)} /Author ${literal(info.author)} /Producer (CarworX) >>`,
  );

  let out = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${String(i + 1)} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${String(objects.length + 1)} /Root ${String(catalog)} 0 R /Info ${String(infoObj)} 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`;

  // Every char is a single byte (winAnsi), so length equals byte offsets.
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
