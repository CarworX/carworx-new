// Operator-only measurement. Private fixture addresses, bodies and cookies never escape.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { requireCondition, stagingOrigin } from "../contract.js";
import { createTimingTrace } from "./timing-trace.js";

export function quantiles(values) {
  requireCondition(
    values.length >= 20 && values.every((v) => Number.isFinite(v) && v >= 0),
    "At least 20 finite timings required",
  );
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p) => sorted[Math.ceil(p * sorted.length) - 1];
  return {
    count: sorted.length,
    p50_ms: at(0.5),
    p95_ms: at(0.95),
    p99_ms: at(0.99),
    max_ms: sorted.at(-1),
  };
}

export function summarizeTiming(samples, metadata) {
  const opaque = (value) =>
    typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
  requireCondition(
    ["local", "staging"].includes(metadata.environment) &&
      typeof metadata.source_sha === "string" &&
      /^[a-f0-9]{40}$/.test(metadata.source_sha) &&
      opaque(metadata.hook_version) &&
      opaque(metadata.configuration_revision) &&
      (metadata.app_version === undefined || opaque(metadata.app_version)),
    "Non-secret timing metadata identifiers required",
  );
  const cases = [];
  for (const key of new Set(
    samples.map((s) => `${s.path}/${s.flow}/${s.cooldown}`),
  )) {
    const rows = samples.filter(
      (s) => `${s.path}/${s.flow}/${s.cooldown}` === key,
    );
    const [path, flow, cooldown] = key.split("/");
    requireCondition(
      ["direct", "app"].includes(path) &&
        ["signup", "resend", "recovery"].includes(flow) &&
        ["fresh", "cooldown"].includes(cooldown),
      "Unknown timing stratum",
    );
    const group = (name) => rows.filter((s) => s.group === name);
    const allowed = group("allowed"),
      denied = group("denied");
    requireCondition(
      allowed.length === denied.length &&
        rows.length === allowed.length + denied.length,
      "Unmatched cohorts",
    );
    const a = quantiles(allowed.map((s) => s.ms)),
      d = quantiles(denied.map((s) => s.ms));
    const correlation_id = rows[0].correlation_id;
    requireCondition(
      typeof correlation_id === "string" &&
        /^[a-f0-9-]{36}$/.test(correlation_id) &&
        rows.every((s) => s.correlation_id === correlation_id),
      "Traceable stratum identity required",
    );
    cases.push({
      path,
      flow,
      cooldown,
      allowed: a,
      denied: d,
      p95_gap_ms: Math.abs(a.p95_ms - d.p95_ms),
      response_shapes_match: rows.every((s) => s.shape === rows[0].shape),
      correlation_id,
    });
  }
  requireCondition(cases.length > 0, "No timing samples");
  // Construct an allowlisted output, never spread caller metadata or raw samples.
  return {
    version: 1,
    kind: "recipient_timing",
    status: "recorded",
    environment: metadata.environment,
    source_sha: metadata.source_sha,
    hook_version: metadata.hook_version,
    app_version: metadata.app_version,
    configuration_revision: metadata.configuration_revision,
    verified_at: new Date().toISOString(),
    cases,
  };
}

export function validateTiming(
  report,
  { path, source_sha, hook_version, configuration_revision },
  now = Date.now(),
) {
  const age = now - Date.parse(report?.verified_at);
  requireCondition(
    report?.version === 1 &&
      report.kind === "recipient_timing" &&
      report.status === "recorded" &&
      report.environment === "staging" &&
      report.source_sha === source_sha &&
      report.hook_version === hook_version &&
      report.configuration_revision === configuration_revision &&
      age >= 0 &&
      age <= 86400000,
    "Fresh deployed timing evidence required",
  );
  for (const flow of ["signup", "resend", "recovery"])
    for (const cooldown of ["fresh", "cooldown"]) {
      const rows = report.cases?.filter(
        (c) => c.path === path && c.flow === flow && c.cooldown === cooldown,
      );
      const c = rows?.[0];
      requireCondition(
        rows?.length === 1 &&
          c.response_shapes_match === true &&
          /^[a-f0-9-]{36}$/.test(c.correlation_id ?? ""),
        "Timing coverage/response-shape mismatch",
      );
      for (const q of [c.allowed, c.denied])
        requireCondition(
          q?.count >= 20 &&
            Number.isInteger(q.count) &&
            [q.p50_ms, q.p95_ms, q.p99_ms, q.max_ms].every(
              (v) => Number.isFinite(v) && v >= 0,
            ) &&
            q.p50_ms <= q.p95_ms &&
            q.p95_ms <= q.p99_ms &&
            q.p99_ms <= q.max_ms,
          "Invalid timing quantiles",
        );
      requireCondition(
        c.allowed.count === c.denied.count,
        "Unmatched timing counts",
      );
    }
  return true;
}

function shape(value, key = "") {
  if (
    /^(?:id|email|access_token|refresh_token|token_hash|csrf|created_at|updated_at|expires_at)$/i.test(
      key,
    )
  )
    return typeof value;
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, shape(value[k], k)]),
    );
  return value;
}

export async function collectTimings(config, send = fetch, trace) {
  requireCondition(trace, "Private run trace required");
  try {
    return await collect(config, send, trace);
  } catch (error) {
    try {
      trace.fail();
    } catch {
      /* Preserve the original failure; publish no report. */
    }
    throw error;
  } finally {
    trace.close();
  }
}

async function collect(config, send, trace) {
  requireCondition(
    ["local", "staging"].includes(config.environment) &&
      /^[a-f0-9]{40}$/.test(config.source_sha),
    "Timing source required",
  );
  const local = config.environment === "local";
  for (const origin of [config.app_origin, config.auth_origin]) {
    const u = new URL(origin);
    requireCondition(
      u.origin === origin && !u.username && !u.password,
      "Invalid timing origin",
    );
    if (local)
      requireCondition(
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname),
        "Local timing must use loopback",
      );
    else stagingOrigin(origin);
  }
  const request = (url, init) =>
    send(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
  const samples = [];
  for (const [caseIndex, c] of config.cases.entries()) {
    requireCondition(
      ["direct", "app"].includes(c.path) &&
        ["signup", "resend", "recovery"].includes(c.flow) &&
        ["fresh", "cooldown"].includes(c.cooldown) &&
        c.pairs.length >= 20 &&
        c.pairs.length <= 100,
      "Invalid timing cases",
    );
    requireCondition(
      c.cooldown !== "fresh" || [200, 302].includes(c.expected_status),
      "Fresh fixtures cannot be throttled",
    );
    // Fixture preparation (account existence and cooldown) is operator controlled.
    // Alternate group order to avoid consistently measuring one cohort on warm connections.
    const correlation_id = trace.begin(caseIndex, c.path, c.flow, c.cooldown);
    for (const [i, pair] of c.pairs.entries())
      for (const group of i % 2
        ? ["denied", "allowed"]
        : ["allowed", "denied"]) {
        const fixture = pair[group];
        let url, init;
        if (c.path === "direct") {
          url = `${config.auth_origin}/auth/v1/${{ signup: "signup", resend: "resend", recovery: "recover" }[c.flow]}`;
          init = {
            method: "POST",
            headers: {
              apikey: config.publishable_key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: fixture.email,
              password: fixture.password,
              ...(c.flow === "resend" ? { type: "signup" } : {}),
            }),
          };
        } else {
          url = `${config.app_origin}/auth/${{ signup: "sign-up", resend: "check-email", recovery: "forgot-password" }[c.flow]}`;
          const page = await request(url);
          const cookie = page.headers
            .getSetCookie()
            .map((v) => v.split(";")[0])
            .find((v) => /^(?:__Host-)?cx-csrf=/.test(v));
          await page.body?.cancel();
          requireCondition(page.ok && cookie, "Timing CSRF setup failed");
          init = {
            method: "POST",
            headers: {
              Origin: config.app_origin,
              Cookie: cookie,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              email: fixture.email,
              password: fixture.password ?? "",
              consent: "on",
              csrf: cookie.slice(cookie.indexOf("=") + 1),
            }),
          };
        }
        const sample = trace.start(correlation_id, i, group);
        const start = performance.now();
        const response = await request(url, init);
        const text = await response.text();
        const ms = performance.now() - start;
        trace.end(sample, ms, response.status);
        requireCondition(
          response.status === c.expected_status &&
            [200, 302, 429].includes(c.expected_status) &&
            text.length < 65536,
          "Unexpected timing response (check fixture/cooldown)",
        );
        let schema;
        try {
          schema = shape(JSON.parse(text));
        } catch {
          schema = {
            type: response.headers.get("Content-Type"),
            bytes: text.length,
          };
        }
        samples.push({
          correlation_id,
          path: c.path,
          flow: c.flow,
          cooldown: c.cooldown,
          group,
          ms,
          shape: createHash("sha256")
            .update(JSON.stringify([response.status, schema]))
            .digest("hex"),
        });
      }
  }
  const report = summarizeTiming(samples, config);
  trace.finish();
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    requireCondition(
      process.env.CARWORX_TIMING_OPERATOR_ACK === "approved-synthetic-fixtures",
      "Operator acknowledgement required",
    );
    const config = JSON.parse(readFileSync(process.argv[2], "utf8"));
    const trace = createTimingTrace(process.argv[3], config);
    const report = await collectTimings(config, fetch, trace);
    console.log(JSON.stringify(report));
  } catch {
    console.error(
      "Timing measurement failed; inspect private fixture preparation and cooldowns",
    );
    process.exitCode = 1;
  }
}
