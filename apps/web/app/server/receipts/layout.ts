/**
 * The CarworX A4 document style, matching the #110 email frame (planning/
 * claude/25 §3a "Layout"): the ink band header, the paper body, the mono
 * ticket, the legal block and page numbers. No signal colour: nothing on
 * paper counts down.
 *
 * Callers give plain strings; this module cleans them (control characters,
 * bidi overrides) and the PDF writer escapes them.
 */
import { clean } from "../mail-templates/format";
import { LEGAL, SUPPORT } from "../mail-templates/frame";
import { A4, hex, Page, wrap, writePdf, type Font, type Rgb } from "./pdf";

export const C = {
  ink: hex("#0d0f12"),
  paper: hex("#f4efe6"),
  muted: hex("#5b6470"),
  rule: hex("#d8d0c2"),
  dash: hex("#b9b4aa"),
  white: hex("#ffffff"),
  blueInk: hex("#2a54d4"),
} as const;

const MARGIN = 48;
const RIGHT = A4.width - MARGIN;
const WIDTH = RIGHT - MARGIN;
const BAND = 64;
const FOOT = 112; // space kept for the legal block and page number
const PAD = 16; // ticket inner padding

export interface TicketRow {
  label: string;
  amount: string;
  strong?: boolean;
}

/** Lays content top to bottom, starting a new page when one is full. */
export class DocumentWriter {
  private readonly pages: Page[] = [];
  private page!: Page;
  private y = 0;

  constructor(
    private readonly docRef: string,
    private readonly title: string,
  ) {
    this.newPage();
  }

  private newPage(): void {
    this.page = new Page();
    this.pages.push(this.page);
    const p = this.page;
    p.rect(0, 0, A4.width, A4.height, C.paper);
    p.rect(0, 0, A4.width, BAND, C.ink);
    p.text(MARGIN, 40, "CarworX", "bold", 20, C.white);
    p.text(RIGHT, 39, this.docRef, "mono", 11, C.white, "right");
    this.y = BAND + 40;
  }

  private room(height: number): void {
    if (this.y + height > A4.height - FOOT) this.newPage();
  }

  gap(points: number): void {
    this.y += points;
  }

  eyebrow(text: string): void {
    this.room(16);
    this.page.text(MARGIN, this.y, text.toUpperCase(), "bold", 9, C.muted);
    this.y += 14;
  }

  heading(text: string, quiet?: string): void {
    this.room(34);
    this.y += 22;
    wrap(clean(text, 80), "bold", 26, WIDTH).forEach((line, i) => {
      if (i > 0) this.y += 30;
      this.page.text(MARGIN, this.y, line, "bold", 26, C.ink);
    });
    this.y += 10;
    if (quiet !== undefined) {
      // A long business name must wrap, not run off the page.
      for (const line of wrap(clean(quiet, 200), "sans", 14, WIDTH)) {
        this.room(20);
        this.y += 18;
        this.page.text(MARGIN, this.y, line, "sans", 14, C.muted);
      }
      this.y += 6;
    }
    this.y += 14;
  }

  paragraph(
    text: string,
    opts: { font?: Font; size?: number; colour?: Rgb; max?: number } = {},
  ): void {
    const font = opts.font ?? "sans";
    const size = opts.size ?? 11;
    const lead = size * 1.45;
    for (const line of wrap(clean(text, opts.max ?? 600), font, size, WIDTH)) {
      this.room(lead);
      this.y += lead;
      this.page.text(MARGIN, this.y, line, font, size, opts.colour ?? C.ink);
    }
    this.y += 8;
  }

  /** The mono ticket: title and ref, item rows, a dashed rule, the total, facts. */
  ticket(spec: {
    title: string;
    ref: string;
    rows: TicketRow[];
    total: TicketRow;
    after?: TicketRow[];
    facts: { label: string; value: string }[];
  }): void {
    const x = MARGIN;
    const labelWidth = WIDTH - 2 * PAD - 120;
    const band = (h: number) => {
      this.room(h);
      this.page.rect(x, this.y, WIDTH, h, C.white);
    };
    band(PAD + 20);
    this.page.line(x, this.y, RIGHT, C.dash, { dash: true });
    this.page.text(x + PAD, this.y + PAD + 10, spec.title, "bold", 12, C.ink);
    this.page.text(
      RIGHT - PAD,
      this.y + PAD + 10,
      spec.ref,
      "mono",
      10,
      C.muted,
      "right",
    );
    this.y += PAD + 20;
    const row = (r: TicketRow) => {
      const lines = wrap(
        clean(r.label, 120),
        r.strong === true ? "bold" : "sans",
        11,
        labelWidth,
      );
      const h = 8 + lines.length * 15;
      band(h);
      lines.forEach((l, i) => {
        this.page.text(
          x + PAD,
          this.y + 15 + i * 15,
          l,
          r.strong === true ? "bold" : "sans",
          11,
          C.ink,
        );
      });
      this.page.text(
        RIGHT - PAD,
        this.y + 15,
        r.amount,
        r.strong === true ? "monoBold" : "mono",
        11,
        C.ink,
        "right",
      );
      this.y += h;
    };
    for (const r of spec.rows) row(r);
    band(10);
    this.page.line(x + PAD, this.y + 6, RIGHT - PAD, C.dash, { dash: true });
    this.y += 10;
    row({ ...spec.total, strong: true });
    for (const r of spec.after ?? []) row(r);
    band(10);
    this.page.line(x + PAD, this.y + 6, RIGHT - PAD, C.rule);
    this.y += 10;
    for (const f of spec.facts) {
      const lines = wrap(
        clean(f.value, 160),
        "mono",
        9.5,
        WIDTH - 2 * PAD - 90,
      );
      const h = 4 + lines.length * 14;
      band(h);
      this.page.text(x + PAD, this.y + 13, f.label, "sans", 9.5, C.muted);
      lines.forEach((l, i) => {
        this.page.text(
          x + PAD + 90,
          this.y + 13 + i * 14,
          l,
          "mono",
          9.5,
          C.ink,
        );
      });
      this.y += h;
    }
    band(PAD);
    this.y += PAD;
    this.page.line(x, this.y, RIGHT, C.dash, { dash: true });
    this.y += 20;
  }

  /** Finish: legal block and "Page n of m" on every page. */
  finish(author = "CarworX"): Uint8Array<ArrayBuffer> {
    const total = this.pages.length;
    this.pages.forEach((p, i) => {
      const top = A4.height - FOOT + 24;
      p.line(MARGIN, top, RIGHT, C.rule);
      p.text(MARGIN, top + 18, LEGAL.name, "bold", 8.5, C.muted);
      p.text(
        MARGIN,
        top + 31,
        `Registration ${LEGAL.registration} · ${LEGAL.address}`,
        "sans",
        8.5,
        C.muted,
      );
      p.text(
        MARGIN,
        top + 44,
        `Questions: ${SUPPORT} · Times are South African Standard Time (SAST, UTC+2).`,
        "sans",
        8.5,
        C.muted,
      );
      p.text(
        RIGHT,
        top + 62,
        `Page ${String(i + 1)} of ${String(total)}`,
        "mono",
        8.5,
        C.muted,
        "right",
      );
      p.text(MARGIN, top + 62, this.docRef, "mono", 8.5, C.muted);
    });
    return writePdf(this.pages, { title: this.title, author });
  }
}
