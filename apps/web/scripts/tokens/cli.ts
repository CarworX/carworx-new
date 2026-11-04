// Usage (from apps/web):
//   node scripts/tokens/cli.ts            write the generated files
//   node scripts/tokens/cli.ts --check    exit 1 if any generated file is stale
//   node scripts/tokens/cli.ts --check --tokens /tmp/scratch/tokens.json
// Node 24 runs this TypeScript directly (type stripping); no build step.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  generateIconsTs,
  generateMarkTs,
  generateTokensCss,
  parseIcon,
  parseMark,
  parseTokens,
  TokenError,
} from "./generate.ts";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repo = resolve(app, "../..");
export const DEFAULT_TOKENS = join(repo, "planning/design/brand/tokens.json");
const CORE = join(repo, "planning/design/brand/exports/core");
export const OUT_CSS = join(app, "app/styles/tokens.generated.css");
export const OUT_MARK = join(app, "app/ui/brand/mark.generated.ts");
export const OUT_ICONS = join(app, "app/ui/icons.generated.ts");
const ICON_DIR = join(repo, "planning/design/brand/exports/studio/icons");

const sha = (...parts: string[]) => {
  const h = createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
};

// Output goes through the repo's Prettier, so `format:check` and the staleness
// check agree on one exact byte string.
async function pretty(path: string, source: string): Promise<string> {
  const prettier = await import("prettier");
  const options = (await prettier.resolveConfig(path)) ?? {};
  return prettier.format(source, { ...options, filepath: path });
}

export async function buildAll(
  tokensPath = DEFAULT_TOKENS,
): Promise<Map<string, string>> {
  const raw = readFileSync(tokensPath, "utf8");
  const tokens = parseTokens(JSON.parse(raw) as unknown);
  for (const f of tokens.type.fonts)
    if (!existsSync(join(dirname(OUT_CSS), f.file)))
      throw new TokenError(
        `font file missing beside the stylesheet: ${f.file}`,
      );
  const css = generateTokensCss(tokens, {
    path: "planning/design/brand/tokens.json",
    sha256: sha(raw),
  });
  const files = [
    "carworx-mark-ink.svg",
    "carworx-mark-small-ink.svg",
    "carworx-lockup-horizontal-ink.svg",
  ].map((f) => readFileSync(join(CORE, f), "utf8"));
  const [full = "", small = "", lockup = ""] = files;
  const mark = generateMarkTs(
    parseMark({ full, small, lockup }),
    sha(...files),
  );
  const iconFiles = readdirSync(ICON_DIR)
    .filter((f) => /^carworx-icon-[a-z]+\.svg$/.test(f))
    .sort();
  const iconSvgs = iconFiles.map((f) =>
    readFileSync(join(ICON_DIR, f), "utf8"),
  );
  const icons = generateIconsTs(
    iconFiles.map((f, i) => [
      f.slice("carworx-icon-".length, -4),
      parseIcon(f, iconSvgs[i] ?? ""),
    ]),
    sha(...iconSvgs),
  );
  return new Map([
    [OUT_CSS, await pretty(OUT_CSS, css)],
    [OUT_MARK, await pretty(OUT_MARK, mark)],
    [OUT_ICONS, await pretty(OUT_ICONS, icons)],
  ]);
}

async function main(argv: string[]): Promise<number> {
  const check = argv.includes("--check");
  const at = argv.indexOf("--tokens");
  const tokensPath = at >= 0 ? resolve(argv[at + 1] ?? "") : DEFAULT_TOKENS;
  let outputs: Map<string, string>;
  try {
    outputs = await buildAll(tokensPath);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
  let stale = 0;
  for (const [path, content] of outputs) {
    const name = relative(app, path);
    const current = existsSync(path) ? readFileSync(path, "utf8") : null;
    if (current === content) {
      console.log(`tokens: ${name} is up to date`);
      continue;
    }
    if (check) {
      console.error(
        `tokens: ${name} is STALE (source ${relative(process.cwd(), tokensPath)}). Run \`pnpm --filter @carworx/web tokens\`.`,
      );
      stale++;
    } else {
      writeFileSync(path, content);
      console.log(`tokens: wrote ${name}`);
    }
  }
  return stale ? 1 : 0;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = await main(process.argv.slice(2));
}
