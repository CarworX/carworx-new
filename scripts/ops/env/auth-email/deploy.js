import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  stagingOrigin,
  requireCondition,
  validateEvidence,
  validateRequest,
} from "../contract.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
export function deploymentPlan(options, env) {
  for (const name of [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_API_KEY",
    "CLOUDFLARE_EMAIL",
  ])
    requireCondition(
      !env[name],
      "Remove API credentials from the owner process; use Wrangler OAuth login",
    );
  const origin = stagingOrigin(options.origin);
  requireCondition(
    /^[a-f0-9]{32}$/.test(options.account ?? ""),
    "Account ID required",
  );
  requireCondition(
    /^[a-f0-9]{40}$/.test(options.sha ?? ""),
    "Reviewed full SHA required",
  );
  requireCondition(
    typeof options.domain === "string" &&
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(
        options.domain,
      ) &&
      !["carworx.app", "www.carworx.app", new URL(origin).hostname].includes(
        options.domain,
      ),
    "Dedicated hook hostname required",
  );
  return {
    worker: "carworx-auth-email-staging",
    args: [
      "deploy",
      "--config",
      "scripts/ops/env/auth-email/wrangler.jsonc",
      "--domain",
      options.domain,
      "--var",
      `APP_ORIGIN:${origin}`,
      "--var",
      `STAGING_PROBE_SOURCE_SHA:${options.sha}`,
      "--tag",
      options.sha,
    ],
    env: {
      ...env,
      CLOUDFLARE_ACCOUNT_ID: options.account,
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
      WRANGLER_SEND_METRICS: "false",
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const entries = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < entries.length; i++) {
      const name = entries[i];
      requireCondition(
        [
          "--account",
          "--domain",
          "--origin",
          "--sha",
          "--pr",
          "--run",
          "--execute",
        ].includes(name),
        "Unknown argument",
      );
      requireCondition(
        !Object.hasOwn(options, name.slice(2)),
        "Duplicate argument",
      );
      options[name.slice(2)] = name === "--execute" ? true : entries[++i];
    }
    const plan = deploymentPlan(options, process.env);
    const git = (...args) =>
      execFileSync("git", args, {
        cwd: root,
        encoding: "utf8",
        stdio: "pipe",
      }).trim();
    requireCondition(
      git("rev-parse", "HEAD") === options.sha &&
        git("status", "--porcelain") === "",
      "Use a clean isolated checkout of the reviewed head",
    );
    const request = validateRequest(options);
    const get = (path) =>
      JSON.parse(
        execFileSync("gh", ["api", `repos/CarworX/carworx-new/${path}`], {
          encoding: "utf8",
          stdio: "pipe",
        }),
      );
    const pages = (path, field) => {
      const result = [];
      for (let page = 1; page <= 100; page++) {
        const response = get(
          `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
        );
        const rows = field ? response[field] : response;
        requireCondition(Array.isArray(rows), "Invalid evidence page");
        result.push(...rows);
        if (rows.length < 100) return result;
      }
      throw new Error("Evidence page limit exceeded");
    };
    const contract = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          'import fs from "node:fs"; process.stdout.write(fs.readFileSync("scripts/ci/contract.json"));',
        ],
        { cwd: root, encoding: "utf8" },
      ),
    );
    const policyFile = get("contents/scripts/ops/env/promotion.json?ref=main");
    const trustedPolicy = JSON.parse(
      Buffer.from(policyFile.content, "base64").toString("utf8"),
    );
    validateEvidence(
      request,
      "CarworX/carworx-new",
      get(`pulls/${request.pr}`),
      get(`actions/runs/${request.run}`),
      pages(`actions/runs/${request.run}/jobs?filter=latest`, "jobs"),
      pages(`pulls/${request.pr}/reviews`),
      contract,
      get(`compare/${request.sha}...main`),
      trustedPolicy,
    );
    const cli = fileURLToPath(
      new URL(
        "../../../../apps/web/node_modules/wrangler/bin/wrangler.js",
        import.meta.url,
      ),
    );
    const who = spawnSync(process.execPath, [cli, "whoami"], {
      cwd: root,
      env: plan.env,
      encoding: "utf8",
      stdio: "pipe",
    });
    requireCondition(
      who.status === 0 && who.stdout.includes(options.account),
      "Owner OAuth login does not expose the selected account",
    );
    const args = [...plan.args, ...(options.execute ? [] : ["--dry-run"])];
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: root,
      env: plan.env,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 600000,
    });
    requireCondition(
      !result.error && result.status === 0,
      "Hook packaging/deployment failed; inspect privately",
    );
    console.log(
      JSON.stringify({
        worker: plan.worker,
        source_sha: options.sha,
        mode: options.execute ? "owner-deploy" : "dry-run",
        status: "passed",
      }),
    );
  } catch {
    console.error(
      "Hook operation failed: verify clean reviewed source, PR/CI, owner OAuth, account and hostname. No private diagnostics published.",
    );
    process.exitCode = 1;
  }
}
