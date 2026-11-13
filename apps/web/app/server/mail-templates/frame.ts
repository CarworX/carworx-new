/**
 * The CarworX email frame (owner's choice, 2026-11-13): A's ink band header,
 * B's paper letter body and mono ticket, C's signal chip for deadlines only.
 *
 * Email-client rules (planning/claude/25-email-design-plan.md §4): tables and
 * inline styles, 600 px, hosted PNG logos, a system-font fallback, dark-mode
 * overrides, 48 px ink buttons, no tracking pixels, a plain-text twin.
 * Every string from a caller passes through esc() here; templates never build
 * HTML themselves.
 */
import { esc } from "./format";

export const SENDER = "no-reply@carworx.app";
export const SUPPORT = "support@carworx.app";
/** OQ-L2: the owner has not supplied these yet. */
export const LEGAL = {
  name: "CarworX (Pty) Ltd",
  registration: "[registration number, OQ-L2]",
  address: "[physical address, OQ-L2]",
};

export type Inline =
  | string
  | { strong: string }
  | { mono: string }
  | { demo: true };
export type Text = Inline | Inline[];

export type Block =
  | { kind: "p"; text: Text; tone?: "muted" }
  | {
      kind: "facts";
      rows: { label: string; value: Text; mono?: boolean; was?: string }[];
    }
  | {
      kind: "ticket";
      title: string;
      ref: string;
      lines: { label: Text; amount: string }[];
      total: { label: string; amount: string };
      meta: { label: string; value: Text }[];
    }
  | { kind: "steps"; items: { title: string; text: string }[] }
  | { kind: "link"; label: string; url: string }
  | { kind: "rule" };

export interface Email {
  subject: string;
  preheader: string;
  /** Mono reference shown on the right of the ink band. */
  ref?: string;
  /** signal = a deadline (never anything else); blue = confirmed. */
  chip?: { tone: "signal" | "blue"; text: string };
  eyebrow: string;
  title: string;
  titleQuiet?: string;
  blocks: Block[];
  /** The one primary action. Always ink. */
  action: { label: string; url: string };
  after?: Block[];
  /** "You're getting this because …" */
  reason: string;
}

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

const C = {
  ink: "#0d0f12",
  paper: "#f4efe6",
  outside: "#e9e7e2",
  muted: "#5b6470",
  rule: "#d8d0c2",
  dash: "#b9b4aa",
  white: "#ffffff",
  peach: "#ffe3d4",
  peachInk: "#8a2a0a",
  signal: "#ff3b0a",
  sky: "#e3eaff",
  blueInk: "#2a54d4",
};
const SANS =
  "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'Geist Mono', ui-monospace, Menlo, Consolas, 'Courier New', monospace";

function inlineHtml(t: Text): string {
  const list = Array.isArray(t) ? t : [t];
  return list
    .map((i) => {
      if (typeof i === "string") return esc(i);
      if ("strong" in i)
        return `<strong style="font-weight:600;color:${C.ink}">${esc(i.strong)}</strong>`;
      if ("mono" in i)
        return `<span style="font-family:${MONO}">${esc(i.mono)}</span>`;
      return ` <span class="cx-muted" style="font-family:${MONO};font-size:11px;letter-spacing:0.08em;color:${C.muted};border:1px solid ${C.rule};border-radius:4px;padding:0 4px">DEMO</span>`;
    })
    .join("");
}

function inlineText(t: Text): string {
  const list = Array.isArray(t) ? t : [t];
  return list
    .map((i) => {
      if (typeof i === "string") return i;
      if ("strong" in i) return i.strong;
      if ("mono" in i) return i.mono;
      return " (DEMO)";
    })
    .join("");
}

const P = `margin:0 0 20px;font-family:${SANS};font-size:16px;line-height:26px;color:${C.ink}`;
const SMALL = `margin:0 0 16px;font-family:${SANS};font-size:14px;line-height:22px;color:${C.muted}`;
const EYEBROW = `font-family:${MONO};font-size:12px;line-height:17px;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted}`;

function blockHtml(b: Block): string {
  switch (b.kind) {
    case "p":
      return `<p class="${b.tone === "muted" ? "cx-muted" : "cx-text"}" style="${b.tone === "muted" ? SMALL : P}">${inlineHtml(b.text)}</p>`;
    case "rule":
      return `<div class="cx-rule" style="height:1px;line-height:1px;font-size:1px;background:${C.rule};margin:4px 0 20px">&nbsp;</div>`;
    case "link":
      return `<p style="${SMALL}"><a href="${esc(b.url)}" class="cx-text" style="color:${C.ink};text-decoration:underline;font-weight:500">${esc(b.label)}</a></p>`;
    case "facts":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24px">${b.rows
        .map(
          (r) =>
            `<tr><td valign="top" class="cx-muted" style="${EYEBROW};padding:10px 16px 10px 0;width:120px;border-top:1px solid ${C.rule}">${esc(r.label)}</td><td valign="top" class="cx-text" style="font-family:${r.mono ? MONO : SANS};font-size:15px;line-height:22px;color:${C.ink};padding:9px 0;border-top:1px solid ${C.rule}">${r.was ? `<span class="cx-muted" style="color:${C.muted};text-decoration:line-through">${esc(r.was)}</span><br>` : ""}${inlineHtml(r.value)}</td></tr>`,
        )
        .join("")}</table>`;
    case "steps":
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24px">${b.items
        .map(
          (s, n) =>
            `<tr><td valign="top" style="font-family:${MONO};font-size:13px;line-height:22px;color:${C.muted};padding:12px 12px 12px 0;width:28px;border-top:1px solid ${C.rule}" class="cx-muted">0${n + 1}</td><td valign="top" style="padding:11px 0;border-top:1px solid ${C.rule}"><div class="cx-text" style="font-family:${SANS};font-size:16px;line-height:24px;font-weight:600;color:${C.ink}">${esc(s.title)}</div><div class="cx-muted" style="font-family:${SANS};font-size:14px;line-height:22px;color:${C.muted}">${esc(s.text)}</div></td></tr>`,
        )
        .join("")}</table>`;
    case "ticket": {
      const dash = `<tr><td colspan="2" style="border-top:1px dashed ${C.dash};font-size:1px;line-height:1px;padding:0">&nbsp;</td></tr>`;
      const row = (l: string, r: string, style = "") =>
        `<tr><td class="cx-text" style="font-family:${MONO};font-size:14px;line-height:21px;color:${C.ink};padding:7px 0;${style}">${l}</td><td align="right" class="cx-text" style="font-family:${MONO};font-size:14px;line-height:21px;color:${C.ink};padding:7px 0 7px 16px;white-space:nowrap;${style}">${r}</td></tr>`;
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="cx-ticket" style="border-collapse:collapse;background:${C.white};margin:0 0 28px"><tr><td style="padding:24px 24px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${row(
        `<span class="cx-muted" style="${EYEBROW}">${esc(b.title)}</span>`,
        `<span class="cx-muted" style="${EYEBROW}">${esc(b.ref)}</span>`,
        "padding-top:0",
      )}${dash}${b.lines.map((l) => row(inlineHtml(l.label), esc(l.amount))).join("")}${dash}${row(
        esc(b.total.label),
        esc(b.total.amount),
        "font-size:18px;line-height:24px;font-weight:500;padding:12px 0",
      )}${dash}</table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px">${b.meta
        .map(
          (m) =>
            `<tr><td class="cx-muted" style="font-family:${MONO};font-size:13px;line-height:20px;color:${C.muted};padding:4px 16px 0 0;width:110px">${esc(m.label)}</td><td class="cx-text" style="font-family:${MONO};font-size:13px;line-height:20px;color:${C.ink};padding:4px 0 0">${inlineHtml(m.value)}</td></tr>`,
        )
        .join("")}</table></td></tr></table>`;
    }
  }
}

function blockText(b: Block): string {
  switch (b.kind) {
    case "p":
      return inlineText(b.text);
    case "rule":
      return "";
    case "link":
      return `${b.label}: ${b.url}`;
    case "facts":
      return b.rows
        .map(
          (r) =>
            `${r.label}: ${inlineText(r.value)}${r.was ? ` (was ${r.was})` : ""}`,
        )
        .join("\n");
    case "steps":
      return b.items
        .map((s, n) => `${n + 1}. ${s.title}. ${s.text}`)
        .join("\n");
    case "ticket":
      return [
        `${b.title} ${b.ref}`,
        "- - - - - - - - - - - - - - - -",
        ...b.lines.map((l) => `${inlineText(l.label)}  ${l.amount}`),
        "- - - - - - - - - - - - - - - -",
        `${b.total.label}  ${b.total.amount}`,
        "- - - - - - - - - - - - - - - -",
        ...b.meta.map((m) => `${m.label}: ${inlineText(m.value)}`),
      ].join("\n");
  }
}

function chipHtml(chip: NonNullable<Email["chip"]>): string {
  if (chip.tone === "signal")
    return `<span class="cx-chip-signal" style="display:inline-block;background:${C.peach};color:${C.peachInk};border-radius:999px;padding:5px 12px 5px 10px;font-family:${SANS};font-size:13px;line-height:18px;font-weight:500"><span style="display:inline-block;width:8px;height:8px;border-radius:8px;background:${C.signal};margin-right:7px;vertical-align:0"></span>${esc(chip.text)}</span>`;
  return `<span class="cx-chip-blue" style="display:inline-block;background:${C.sky};color:${C.blueInk};border-radius:999px;padding:5px 12px;font-family:${SANS};font-size:13px;line-height:18px;font-weight:500">&#10003;&nbsp;${esc(chip.text)}</span>`;
}

/** Hosted assets: stable paths under apps/web/public/email/. */
export function assetUrl(origin: string, file: string): string {
  return `${origin.replace(/\/$/, "")}/email/${file}`;
}

export function renderEmail(email: Email, origin: string): Rendered {
  const logo = assetUrl(origin, "carworx-lockup-on-ink@2x.png");
  const fonts = assetUrl(origin, "");
  const body = email.blocks.map(blockHtml).join("");
  const after = (email.after ?? []).map(blockHtml).join("");
  const privacy = `${origin.replace(/\/$/, "")}/privacy`;
  const html = `<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(email.subject)}</title>
<style>
@font-face{font-family:Geist;src:url(${fonts}Geist-latin.woff2) format("woff2");font-weight:200 700;font-display:swap}
@font-face{font-family:"Geist Mono";src:url(${fonts}GeistMono-latin.woff2) format("woff2");font-weight:400 500;font-display:swap}
@media (max-width:620px){.cx-pad{padding-left:24px!important;padding-right:24px!important}.cx-h1{font-size:30px!important;line-height:34px!important}}
@media (prefers-color-scheme:dark){
.cx-outside{background:#000000!important}.cx-body{background:#1c2128!important}
.cx-text,.cx-h1{color:#f2f1ee!important}.cx-muted{color:#a9b0b9!important}
.cx-rule{background:#39414c!important}.cx-ticket{background:#0d0f12!important}
.cx-btn{background:#f4efe6!important}.cx-btn a{color:#0d0f12!important}
}
</style>
</head>
<body class="cx-outside" style="margin:0;padding:0;background:${C.outside};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${esc(email.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="cx-outside" style="border-collapse:collapse;background:${C.outside}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" class="cx-body" style="border-collapse:collapse;width:100%;max-width:600px;background:${C.paper}">
<tr><td class="cx-pad" bgcolor="${C.ink}" style="background:${C.ink};padding:26px 40px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
<td><img src="${esc(logo)}" width="140" height="28" alt="CarworX" style="display:block;border:0;width:140px;height:28px;color:${C.white};font-family:${SANS};font-size:20px;font-weight:600"></td>
${email.ref ? `<td align="right" style="font-family:${MONO};font-size:13px;line-height:18px;color:${C.white}">${esc(email.ref)}</td>` : ""}
</tr></table>
</td></tr>
<tr><td class="cx-pad" style="padding:40px 40px 12px">
${email.chip ? `<div style="margin:0 0 20px">${chipHtml(email.chip)}</div>` : ""}
<div class="cx-muted" style="${EYEBROW};margin:0 0 12px">${esc(email.eyebrow)}</div>
<h1 class="cx-h1" style="margin:0 0 20px;font-family:${SANS};font-size:34px;line-height:38px;font-weight:500;letter-spacing:-0.03em;color:${C.ink}">${esc(email.title)}${email.titleQuiet ? `<br><span class="cx-muted" style="color:${C.muted}">${esc(email.titleQuiet)}</span>` : ""}</h1>
${body}
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:4px 0 24px"><tr><td class="cx-btn" bgcolor="${C.ink}" style="background:${C.ink};border-radius:999px">
<a href="${esc(email.action.url)}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;line-height:20px;font-weight:500;color:${C.white};text-decoration:none;border-radius:999px">${esc(email.action.label)}</a>
</td></tr></table>
<p class="cx-muted" style="${SMALL}">Button not working? Copy this link into your browser:<br><span style="font-family:${MONO};font-size:13px;color:${C.ink};word-break:break-all" class="cx-text">${esc(email.action.url)}</span></p>
${after}
</td></tr>
<tr><td class="cx-pad" style="padding:0 40px 32px">
<div class="cx-rule" style="height:1px;line-height:1px;font-size:1px;background:${C.rule};margin:0 0 20px">&nbsp;</div>
<p class="cx-muted" style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:19px;color:${C.muted}">Sent from ${SENDER}. Replies go to <a href="mailto:${SUPPORT}" class="cx-muted" style="color:${C.muted}">${SUPPORT}</a>.</p>
<p class="cx-muted" style="margin:0 0 6px;font-family:${SANS};font-size:12px;line-height:19px;color:${C.muted}">You're getting this because ${esc(email.reason)}</p>
<p class="cx-muted" style="margin:0;font-family:${SANS};font-size:12px;line-height:19px;color:${C.muted}">${esc(LEGAL.name)} · ${esc(LEGAL.registration)} · ${esc(LEGAL.address)} · <a href="${esc(privacy)}" class="cx-muted" style="color:${C.muted}">Privacy</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
  const text = [
    email.chip ? `[${email.chip.text}]` : "",
    email.title,
    email.titleQuiet ?? "",
    "",
    email.blocks.map(blockText).filter((s) => s !== "").join("\n\n"),
    "",
    `${email.action.label}: ${email.action.url}`,
    "",
    (email.after ?? []).map(blockText).filter((s) => s !== "").join("\n\n"),
    "",
    "--",
    `Sent from ${SENDER}. Replies go to ${SUPPORT}.`,
    `You're getting this because ${email.reason}`,
    `${LEGAL.name} · ${LEGAL.registration} · ${LEGAL.address}`,
    `Privacy: ${privacy}`,
    "",
  ]
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n{3,}/g, "\n\n");
  return { subject: email.subject, html, text };
}
