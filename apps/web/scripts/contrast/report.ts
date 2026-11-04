// The contrast check (G15): measures every registered pair against the real
// token values and reports. Shared by cli.ts and the unit tests.
import {
  FLOOR,
  measure,
  type Kind,
  type Measured,
  type Pair,
} from "../../app/ui/contrast.ts";
import { PAIRS } from "../../app/ui/contrast-pairs.ts";
import type { TokensV4 } from "../tokens/generate.ts";

export interface Report {
  measured: Measured[];
  failures: Measured[];
  ok: boolean;
}

export function colorMap(tokens: TokensV4): Record<string, string> {
  return Object.fromEntries(tokens.color.tokens.map((t) => [t.name, t.value]));
}

export function check(
  tokens: TokensV4,
  extra: readonly Pair[] = [],
  pairs: readonly Pair[] = PAIRS,
): Report {
  const measured = measure([...pairs, ...extra], colorMap(tokens));
  const failures = measured.filter((m) => !m.pass);
  // Measuring nothing is a failure, not a pass (the G15 defect).
  return {
    measured,
    failures,
    ok: measured.length > 0 && failures.length === 0,
  };
}

/** "fg:bg[:kind]" → a pair, for deliberately testing a colour from the CLI. */
export function parsePairArg(arg: string): Pair {
  const [fg, bg, kind = "text"] = arg.split(":");
  if (!fg || !bg || !(kind in FLOOR))
    throw new Error(`--pair wants fg:bg[:text|large|ui], got ${arg}`);
  return { where: `--pair ${arg}`, fg, bg, kind: kind as Kind };
}

export function format(r: Report): string {
  const rows = r.measured.map(
    (m) =>
      `${m.pass ? "pass" : "FAIL"}  ${m.ratio.toFixed(2).padStart(5)}:1 ≥ ${m.floor.toFixed(1)}  ${m.fg}${m.via ? ` on ${m.via} over` : " on"} ${m.bg}  · ${m.where}`,
  );
  const pages404 = r.measured.filter((m) => m.where.startsWith("404")).length;
  rows.push(
    "",
    `contrast: ${String(r.measured.length)} pairs measured (${String(pages404)} on the 404 page), ${String(r.failures.length)} below the floor.`,
  );
  return rows.join("\n");
}
