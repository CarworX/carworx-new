// Every foreground/ground pair the Studio components and the D-041 states
// draw, by token. The unit tests and `pnpm --filter @carworx/web contrast`
// measure them against the generated token values. Import-free on purpose
// (see contrast.ts). Add a pair whenever a component gains a new colour.
import type { Pair } from "./contrast";

export const PAIRS: readonly Pair[] = [
  // ---- the 404 page (G15: the approved page, measured) ----
  { where: "404 · eyebrow", fg: "muted", bg: "canvas", kind: "text" },
  { where: "404 · headline", fg: "ink", bg: "canvas", kind: "large" },
  {
    where: "404 · headline grey line (32–56 px)",
    fg: "quiet",
    bg: "canvas",
    kind: "large",
  },
  { where: "404 · sub line", fg: "muted", bg: "canvas", kind: "text" },
  { where: "404 · Back to home pill", fg: "white", bg: "ink", kind: "text" },
  { where: "404 · Find a service link", fg: "ink", bg: "canvas", kind: "text" },
  {
    where: "404 · service chips",
    fg: "graphite",
    bg: "canvas",
    via: "frost",
    kind: "text",
  },
  { where: "404 · numeral dots", fg: "ink", bg: "canvas", kind: "ui" },
  {
    where: "404 · numeral dots under the lens",
    fg: "blue",
    bg: "canvas",
    kind: "ui",
  },
  { where: "404 · focus ring", fg: "ink", bg: "canvas", kind: "ui" },
  // ---- text on the page grounds ----
  { where: "body on canvas", fg: "ink", bg: "canvas", kind: "text" },
  {
    where: "caption / eyebrow on canvas",
    fg: "muted",
    bg: "canvas",
    kind: "text",
  },
  { where: "body on surface", fg: "ink", bg: "surface", kind: "text" },
  { where: "caption on surface", fg: "muted", bg: "surface", kind: "text" },
  {
    where: "muted on canvas-2 (tracks, wells)",
    fg: "muted",
    bg: "canvas-2",
    kind: "text",
  },
  {
    where: "secondary text on canvas",
    fg: "graphite",
    bg: "canvas",
    kind: "text",
  },
  // ---- buttons ----
  { where: "primary button", fg: "white", bg: "ink", kind: "text" },
  {
    where: "secondary / outline button",
    fg: "ink",
    bg: "surface",
    kind: "text",
  },
  { where: "disabled button", fg: "muted", bg: "canvas-2", kind: "text" },
  { where: "quiet link on canvas", fg: "muted", bg: "canvas", kind: "text" },
  // ---- chips, labels, slots, actors ----
  { where: "filter chip", fg: "ink", bg: "surface", kind: "text" },
  { where: "filter chip, pressed", fg: "white", bg: "ink", kind: "text" },
  { where: "label · ok", fg: "ok", bg: "ok-bg", kind: "text" },
  { where: "label · info", fg: "blue-ink", bg: "sky", kind: "text" },
  { where: "label · warn", fg: "warn", bg: "warn-bg", kind: "text" },
  { where: "label · err", fg: "err", bg: "err-bg", kind: "text" },
  { where: "demo tag", fg: "muted", bg: "canvas", kind: "text" },
  { where: "time slot", fg: "ink", bg: "surface", kind: "text" },
  { where: "time slot, chosen", fg: "white", bg: "ink", kind: "text" },
  { where: "time slot, taken", fg: "muted", bg: "canvas-2", kind: "text" },
  { where: "actor · business", fg: "blue-ink", bg: "sky", kind: "text" },
  { where: "actor · CarworX", fg: "peach-ink", bg: "peach", kind: "text" },
  // ---- control edges (G1 / D-066) ----
  { where: "edge · input", fg: "control-edge", bg: "surface", kind: "ui" },
  {
    where: "edge · chip, slot, outline button, checkbox",
    fg: "control-edge",
    bg: "surface",
    kind: "ui",
  },
  { where: "focus ring on surface", fg: "ink", bg: "surface", kind: "ui" },
  // ---- fields and notes ----
  { where: "field label and value", fg: "ink", bg: "surface", kind: "text" },
  { where: "field error", fg: "err", bg: "canvas", kind: "text" },
  { where: "placeholder", fg: "muted", bg: "surface", kind: "text" },
  { where: "note · info icon", fg: "blue-ink", bg: "surface", kind: "ui" },
  { where: "note · warn text", fg: "ink", bg: "warn-bg", kind: "text" },
  { where: "note · err text", fg: "ink", bg: "err-bg", kind: "text" },
  { where: "note · ok text", fg: "ink", bg: "ok-bg", kind: "text" },
  // ---- nav ----
  { where: "nav link", fg: "muted", bg: "canvas", via: "frost", kind: "text" },
  {
    where: "nav link, current",
    fg: "ink",
    bg: "canvas",
    via: "frost",
    kind: "text",
  },
  // ---- booking objects and loaders ----
  { where: "hold dial digits", fg: "ink", bg: "canvas-2", kind: "large" },
  {
    where: "hold dial ring (counting down)",
    fg: "signal",
    bg: "surface",
    kind: "ui",
  },
  { where: "hold dial ring, paid", fg: "ok", bg: "surface", kind: "ui" },
  { where: "step dial arc", fg: "blue", bg: "surface", kind: "ui" },
  { where: "step dial status line", fg: "muted", bg: "canvas", kind: "text" },
  { where: "sticky note", fg: "#3a3326", bg: "note", kind: "text" },
  { where: "receipt stamp", fg: "blue-ink", bg: "#fffdf9", kind: "text" },
  { where: "KPI number", fg: "ink", bg: "surface", kind: "large" },
  { where: "ripple caption", fg: "muted", bg: "canvas", kind: "text" },
  // ---- onboarding redesign (Claude 23 O1) ----
  { where: "segmented progress fill", fg: "ink", bg: "canvas-2", kind: "ui" },
  {
    where: "segmented progress count",
    fg: "muted",
    bg: "canvas",
    kind: "text",
  },
  {
    where: "filter bar, unselected",
    fg: "muted",
    bg: "canvas",
    via: "frost",
    kind: "text",
  },
  { where: "filter bar, selected", fg: "white", bg: "ink", kind: "text" },
  {
    where: "choice tile and pick edge",
    fg: "control-edge",
    bg: "surface",
    kind: "ui",
  },
  { where: "choice tile hint", fg: "muted", bg: "surface", kind: "text" },
  {
    where: "picked chip, day, switch on",
    fg: "white",
    bg: "ink",
    kind: "text",
  },
  {
    where: "switch track edge and knob (off)",
    fg: "control-edge",
    bg: "surface",
    kind: "ui",
  },
  { where: "account menu, Sign out", fg: "err", bg: "surface", kind: "text" },
  { where: "account avatar initials", fg: "white", bg: "ink", kind: "text" },
];
