// Usage (from apps/web):
//   node scripts/contrast/cli.ts
//   node scripts/contrast/cli.ts --tokens /tmp/scratch/tokens.json
//   node scripts/contrast/cli.ts --pair line:surface:ui     (a deliberately low pair: exits 1)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEFAULT_TOKENS } from "../tokens/cli.ts";
import { parseTokens } from "../tokens/generate.ts";
import { check, format, parsePairArg } from "./report.ts";

const argv = process.argv.slice(2);
const at = argv.indexOf("--tokens");
const path = at >= 0 ? resolve(argv[at + 1] ?? "") : DEFAULT_TOKENS;
const extra = argv.flatMap((a, i) =>
  argv[i - 1] === "--pair" ? [parsePairArg(a)] : [],
);
const report = check(
  parseTokens(JSON.parse(readFileSync(path, "utf8")) as unknown),
  extra,
);
console.log(format(report));
process.exitCode = report.ok ? 0 : 1;
