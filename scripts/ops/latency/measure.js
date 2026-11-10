// Latency check for the region decision (P2-9, PLAN §4, G-PROD).
//
// The owner runs this from a South African connection, once from
// Johannesburg and once from Cape Town. It times TCP and TLS handshakes to
// public AWS regional endpoints in London (eu-west-2) and Frankfurt
// (eu-central-1), the two candidate Supabase regions. It contacts no CarworX
// resource unless the owner adds one with --target.
//
// It prints a JSON summary. The summary never contains an IP address: only
// the Cloudflare edge code (for example JNB) and country from Cloudflare's
// public trace page, so a reviewer can see which city the run came from.
//
// Usage: node scripts/ops/latency/measure.js [--samples 30] [--label jnb]
//        [--target name=host:port] [--out file.json]

import { writeFileSync } from "node:fs";
import { connect as netConnect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { pathToFileURL } from "node:url";

export const DEFAULT_TARGETS = Object.freeze([
  { name: "london-eu-west-2", host: "ec2.eu-west-2.amazonaws.com", port: 443 },
  {
    name: "frankfurt-eu-central-1",
    host: "ec2.eu-central-1.amazonaws.com",
    port: 443,
  },
]);

const TRACE_URL = "https://www.cloudflare.com/cdn-cgi/trace";
const TIMEOUT_MS = 5000;
const GAP_MS = 200;
const MAX_SAMPLES = 200;

export function parseArgs(argv) {
  const options = { samples: 30, label: "", out: "", targets: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (value === undefined) throw new Error("Missing value for " + flag);
    i += 1;
    if (flag === "--samples") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 5 || n > MAX_SAMPLES) {
        throw new Error(
          "--samples must be an integer from 5 to " + MAX_SAMPLES,
        );
      }
      options.samples = n;
    } else if (flag === "--label") {
      if (!/^[a-z0-9-]{1,32}$/.test(value)) {
        throw new Error("--label must be 1-32 lowercase letters, digits or -");
      }
      options.label = value;
    } else if (flag === "--out") {
      options.out = value;
    } else if (flag === "--target") {
      options.targets.push(parseTarget(value));
    } else {
      throw new Error("Unknown option " + flag);
    }
  }
  return options;
}

export function parseTarget(text) {
  const match = /^([a-z0-9-]{1,40})=([a-z0-9.-]{1,253}):(\d{1,5})$/.exec(text);
  if (!match) throw new Error("--target must look like name=host:port");
  const port = Number(match[3]);
  if (port < 1 || port > 65535) throw new Error("Port out of range");
  return { name: match[1], host: match[2], port };
}

// Keeps only the edge code and country. The trace also holds the caller's
// IP address, which must never reach the output.
export function parseTrace(text) {
  const fields = {};
  for (const line of String(text).split("\n")) {
    const at = line.indexOf("=");
    if (at > 0) fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  const colo = /^[A-Z]{3}$/.test(fields.colo ?? "") ? fields.colo : null;
  const loc = /^[A-Z]{2}$/.test(fields.loc ?? "") ? fields.loc : null;
  return { colo, loc };
}

export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
}

const round = (ms) => Math.round(ms * 10) / 10;

export function summarise(samples) {
  const ok = samples.filter((s) => typeof s === "number" && Number.isFinite(s));
  const sorted = [...ok].sort((a, b) => a - b);
  return {
    count: samples.length,
    failed: samples.length - ok.length,
    min_ms: sorted.length ? round(sorted[0]) : null,
    p50_ms: sorted.length ? round(percentile(sorted, 50)) : null,
    p95_ms: sorted.length ? round(percentile(sorted, 95)) : null,
    max_ms: sorted.length ? round(sorted[sorted.length - 1]) : null,
  };
}

// A target's result counts only if almost every sample succeeded: at most
// 10% failures and at least 5 successes. Otherwise a few lucky samples could
// decide the region.
export const MAX_FAILURE_RATE = 0.1;
export const MIN_SUCCESSES = 5;

export function usable(summary) {
  const successes = summary.count - summary.failed;
  return (
    summary.p50_ms !== null &&
    successes >= MIN_SUCCESSES &&
    summary.failed <= summary.count * MAX_FAILURE_RATE
  );
}

// "London is faster" only when its median wins by at least `margin` ms and
// both targets have a usable result.
export function compare(london, frankfurt, margin = 10) {
  if (!usable(london) || !usable(frankfurt)) return "no-result";
  const gap = round(frankfurt.p50_ms - london.p50_ms);
  if (gap >= margin) return "london-faster";
  if (gap <= -margin) return "frankfurt-faster";
  return "within-margin";
}

export function sastTimestamp(date) {
  const shifted = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  return shifted.toISOString().replace("Z", "+02:00");
}

export function timeHandshake(target, secure) {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = secure
      ? tlsConnect({
          host: target.host,
          port: target.port,
          servername: target.host,
        })
      : netConnect({ host: target.host, port: target.port });
    const done = (value) => {
      clearTimeout(timer);
      socket.destroy();
      resolve(value);
    };
    const timer = setTimeout(() => done(null), TIMEOUT_MS);
    socket.once(secure ? "secureConnect" : "connect", () =>
      done(performance.now() - start),
    );
    socket.once("error", () => done(null));
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Round-robin: every round takes one TCP and one TLS sample from each target
// in turn, so all targets are measured over the same time window and a
// change in the local line's congestion affects them equally.
export async function measureAll(
  targets,
  samples,
  time = timeHandshake,
  pause = sleep,
) {
  const raw = targets.map(() => ({ tcp: [], tls: [] }));
  for (let i = 0; i < samples; i += 1) {
    for (const [index, target] of targets.entries()) {
      raw[index].tcp.push(await time(target, false));
      await pause(GAP_MS);
      raw[index].tls.push(await time(target, true));
      await pause(GAP_MS);
    }
  }
  return targets.map((target, index) => ({
    name: target.name,
    host: target.host,
    tcp: summarise(raw[index].tcp),
    tls: summarise(raw[index].tls),
  }));
}

async function edge() {
  try {
    const response = await fetch(TRACE_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return parseTrace(await response.text());
  } catch {
    return { colo: null, loc: null };
  }
}

export async function main(argv) {
  const options = parseArgs(argv);
  const targets = [...DEFAULT_TARGETS, ...options.targets];
  const results = await measureAll(targets, options.samples);
  const byName = Object.fromEntries(results.map((r) => [r.name, r]));
  const report = {
    version: 1,
    label: options.label || null,
    measured_at_sast: sastTimestamp(new Date()),
    edge: await edge(),
    node: process.version,
    samples: options.samples,
    results,
    tcp_verdict: compare(
      byName["london-eu-west-2"].tcp,
      byName["frankfurt-eu-central-1"].tcp,
    ),
  };
  const text = JSON.stringify(report, null, 2) + "\n";
  if (options.out) writeFileSync(options.out, text);
  process.stdout.write(text);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(String(error.message ?? error) + "\n");
    process.exitCode = 1;
  });
}
