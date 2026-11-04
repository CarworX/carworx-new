import { appendFileSync } from "node:fs";
import {
  context,
  invariant,
  readJson,
  validateGate,
  writeEvidence,
} from "./core.js";

const ctx = context();
let status = "failed";
try {
  const needs = JSON.parse(process.env.CI_NEEDS);
  const reports = {};
  for (const job of ["checks", "secrets"]) {
    invariant(needs[job]?.outputs?.summary, "Required job summary missing");
    reports[job] = JSON.parse(
      Buffer.from(needs[job].outputs.summary, "base64").toString("utf8"),
    );
  }
  const event = readJson(process.env.GITHUB_EVENT_PATH);
  invariant(
    /^[\w.-]+\/[\w.-]+$/.test(ctx.repository) && Number.isInteger(event.number),
    "Invalid PR coordinates",
  );
  const response = await fetch(
    `https://api.github.com/repos/${ctx.repository}/pulls/${event.number}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(30000),
    },
  );
  invariant(response.ok, "Cannot verify current PR head");
  const current = await response.json();
  validateGate(
    Object.fromEntries(Object.entries(needs).map(([k, v]) => [k, v.result])),
    reports,
    ctx.head_sha,
    current.head?.sha,
  );
  invariant(current.state === "open", "PR is no longer open");
  status = "passed";
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  writeEvidence("gate", { context: ctx, status });
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## K1 CI: ${status}\n\nTested head: \`${ctx.head_sha}\`\n\nRun: ${ctx.run_id}, attempt ${ctx.attempt}. Future suites are not feature acceptance until required and executed.\n`,
  );
}
