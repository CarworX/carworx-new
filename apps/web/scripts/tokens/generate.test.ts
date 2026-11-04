import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildAll,
  DEFAULT_TOKENS,
  OUT_CSS,
  OUT_ICONS,
  OUT_MARK,
} from "./cli.ts";
import {
  generateTokensCss,
  parseIcon,
  parseMark,
  parseTokens,
  TokenError,
} from "./generate.ts";

const raw = readFileSync(DEFAULT_TOKENS, "utf8");
const json = () =>
  JSON.parse(raw) as {
    color: { tokens: { name: string; value: string }[] };
    version: number;
  };
const cli = join(import.meta.dirname, "cli.ts");

function scratch(mutate: (t: ReturnType<typeof json>) => void) {
  const t = json();
  mutate(t);
  const dir = mkdtempSync(join(tmpdir(), "cx-tokens-"));
  const path = join(dir, "tokens.json");
  writeFileSync(path, JSON.stringify(t, null, 2));
  return path;
}

function runCheck(tokensPath?: string) {
  try {
    const out = execFileSync(
      process.execPath,
      [cli, "--check", ...(tokensPath ? ["--tokens", tokensPath] : [])],
      { encoding: "utf8", stdio: "pipe" },
    );
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: err.stdout + err.stderr };
  }
}

describe("token generator (D1)", () => {
  it("committed outputs are exactly what tokens.json v4 generates", async () => {
    const outputs = await buildAll();
    expect([...outputs.keys()].sort()).toEqual(
      [OUT_CSS, OUT_ICONS, OUT_MARK].sort(),
    );
    for (const [path, content] of outputs)
      expect(readFileSync(path, "utf8"), path).toBe(content);
  });

  it("the check passes on the real tokens", () => {
    const r = runCheck();
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain("up to date");
  });

  it("the check fails when one colour changes without regenerating", () => {
    const path = scratch((t) => {
      const ink = t.color.tokens.find((c) => c.name === "ink");
      if (ink) ink.value = "#0d0f13";
    });
    const r = runCheck(path);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/tokens\.generated\.css is STALE/);
  });

  it("every colour token becomes a Tailwind colour and a Studio variable", () => {
    const css = generateTokensCss(parseTokens(json()), {
      path: "x",
      sha256: "0",
    });
    for (const c of json().color.tokens) {
      expect(css).toContain(`--color-${c.name}: ${c.value};`);
      expect(css).toContain(`--${c.name}: var(--color-${c.name});`);
    }
    // Tailwind's own palette is cleared: only Studio colours exist.
    expect(css).toContain("--color-*: initial;");
  });

  it("keeps D-066's control edge", () => {
    const css = generateTokensCss(parseTokens(json()), {
      path: "x",
      sha256: "0",
    });
    expect(css).toContain("--color-control-edge: #8b929b;");
  });

  it("declares the three self-hosted faces and no remote URL", () => {
    const css = generateTokensCss(parseTokens(json()), {
      path: "x",
      sha256: "0",
    });
    for (const f of ["Geist-latin", "GeistMono-latin", "Caveat-latin"])
      expect(css).toContain(`url("./fonts/${f}.woff2")`);
    expect(css).not.toMatch(/https?:\/\//);
  });

  it("rejects the wrong version, bad colours and CSS injection", () => {
    expect(() => parseTokens({ ...json(), version: 3 })).toThrow(TokenError);
    const bad = json();
    const c0 = bad.color.tokens[0];
    if (c0) c0.value = "red";
    expect(() => parseTokens(bad)).toThrow(/must be #rrggbb/);
    const inj = json();
    const c1 = inj.color.tokens[1];
    if (c1) c1.value = "#fff;} body{display:none";
    expect(() => parseTokens(inj)).toThrow(/unsafe/);
    expect(() => parseTokens("nope")).toThrow(TokenError);
  });
});

describe("mark and icon sources", () => {
  const core = join(DEFAULT_TOKENS, "../exports/core");
  const read = (f: string) => readFileSync(join(core, f), "utf8");
  const src = {
    full: read("carworx-mark-ink.svg"),
    small: read("carworx-mark-small-ink.svg"),
    lockup: read("carworx-lockup-horizontal-ink.svg"),
  };

  it("takes the blade and rest angle from the exported logo", () => {
    const m = parseMark(src);
    expect(m.blade.startsWith("M0,-21")).toBe(true);
    expect(m.rest).toBeCloseTo(21.9494, 4);
    expect(m.word).toHaveLength(7);
  });

  it("refuses a redrawn blade", () => {
    const tampered = src.full.replace(
      /rotate\(144\)" d="M0,-21/,
      'rotate(144)" d="M1,-21',
    );
    expect(() => parseMark({ ...src, full: tampered })).toThrow(
      /blades differ/,
    );
  });

  it("refuses unexpected markup in a glyph", () => {
    const g =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><g fill="none" stroke="#0d0f12" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
    expect(parseIcon("ok", `${g}<path d="M4 12h15"/></g></svg>`)).toEqual([
      ["path", { d: "M4 12h15" }],
    ]);
    expect(() =>
      parseIcon("x", `${g}<script>alert(1)</script></g></svg>`),
    ).toThrow(/unexpected markup/);
  });
});
