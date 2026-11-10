import { createLedger, recordEvent, sealNegative } from "./probe-ledger.js";

const encoder = new TextEncoder();
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const digest = /^[a-f0-9]{64}$/;

async function hmacKey(secret, usage) {
  if (typeof secret !== "string" || secret.length < 32)
    throw Error("Probe key unavailable");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export async function probeSignature(secret, message) {
  const key = await hmacKey(secret, "sign");
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(message)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
const send = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

async function requestText(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("Missing probe message");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let length = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    length += value.byteLength;
    if (length > 4096) {
      await reader.cancel();
      throw Error("Probe message exceeds limit");
    }
    text += decoder.decode(value, { stream: true });
  }
}

export function recipientId(secret, canonicalAddress) {
  return probeSignature(
    secret,
    "carworx-probe-recipient-v1\n" + canonicalAddress,
  );
}

function getProbe(env, recipient) {
  if (!digest.test(recipient)) throw Error("Invalid probe identity");
  return env.STAGING_PROBES.get(env.STAGING_PROBES.idFromName(recipient));
}

async function sendProbe(env, recipient, message) {
  const response = await getProbe(env, recipient).fetch(
    "https://probe.invalid/event",
    {
      method: "POST",
      body: JSON.stringify(message),
    },
  );
  if (!response.ok) throw Error("Probe observation rejected");
  return response;
}

export async function probeEndpoint(request, env) {
  if (request.method !== "POST") return send({}, 405);
  try {
    const stamp = request.headers.get("x-carworx-probe-time");
    const signature = request.headers.get("x-carworx-probe-signature");
    const role = request.headers.get("x-carworx-probe-role");
    if (
      !/^\d{13}$/.test(stamp ?? "") ||
      Math.abs(Date.now() - Number(stamp)) > 30_000 ||
      !digest.test(signature ?? "") ||
      !["operator", "app"].includes(role)
    )
      return send({}, 401);
    const text = await requestText(request);
    const secret =
      role === "operator"
        ? env.STAGING_PROBE_ADMIN_KEY
        : env.STAGING_PROBE_EVENT_KEY;
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await hmacKey(secret, "verify"),
        Uint8Array.from(signature.match(/../g), (pair) =>
          Number.parseInt(pair, 16),
        ),
        encoder.encode(`carworx-probe-v1\n${role}\n${stamp}\n${text}`),
      ))
    )
      return send({}, 401);
    const body = JSON.parse(text);
    const { recipient, id, op, kind, version, flow, app_version } = body;
    if (
      op === "event" &&
      role === "app" &&
      ["app_terminal", "auth_attempt"].includes(kind)
    ) {
      return await sendProbe(env, recipient, { op, id, kind, app_version });
    }
    if (role !== "operator") return send({}, 403);
    if (op === "register") {
      if (version !== env.STAGING_PROBE_SOURCE_SHA) return send({}, 409);
      return await sendProbe(env, recipient, {
        op,
        id,
        version,
        flow,
        app_version,
      });
    }
    if (op === "seal") return await sendProbe(env, recipient, { op, id });
    if (op === "read" && version === env.STAGING_PROBE_SOURCE_SHA)
      return await sendProbe(env, recipient, { op, id, flow, version });
    if (op === "event" && kind === "link_verified") {
      return await sendProbe(env, recipient, { op, id, kind, app_version });
    }
    return send({}, 400);
  } catch {
    return send({}, 409);
  }
}

export async function observeHook(kind, { recipient, id, eligible }, env) {
  if (!env.STAGING_PROBE_EVENT_KEY || !env.STAGING_PROBES) return;
  const key = await recipientId(env.STAGING_PROBE_EVENT_KEY, recipient);
  const signature = await probeSignature(
    env.STAGING_PROBE_EVENT_KEY,
    `hook-event\n${kind}\n${id}`,
  );
  const event = signature
    .slice(0, 32)
    .replace(/^(........)(....)(....)(....)(............)$/, "$1-$2-$3-$4-$5");
  const response = await sendProbe(env, key, { op: "event", id: event, kind });
  return response.json();
}

// One observer per webhook request. An unavailable initial lookup supplies no
// usable probe evidence. Once a registration is confirmed, observations must
// succeed so a probe cannot produce a passing receipt with missing events.
export function createHookObserver() {
  let active = false;
  return async (kind, event, env) => {
    try {
      const observed = await observeHook(kind, event, env);
      active ||= observed?.active === true;
      if (
        active &&
        kind === "hook_invocation" &&
        event.eligible &&
        observed.inject_failure
      ) {
        await observeHook(
          "hook_failure",
          { ...event, id: crypto.randomUUID() },
          env,
        );
        throw Error("Controlled staging probe fault");
      }
    } catch (error) {
      if (active) throw error;
    }
  };
}
const positive = ["approved_confirmation", "approved_recovery"];
const negative = [
  "unapproved_signup",
  "unapproved_resend",
  "unapproved_recovery",
  "unsupported_action",
  "hook_failure_no_fallback",
];
const app = ["app_signup", "app_resend", "app_recovery"];

export class StagingProbe {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    try {
      const body = await request.json();
      const result = await this.storage.transaction(async (storage) => {
        const current = await storage.get("probe");
        const now = Date.now();
        if (body.op === "register") {
          if (current && !current.sealed && now < current.expires) {
            if (
              current.id === body.id &&
              current.version === body.version &&
              current.flow === body.flow
            )
              return { correlation_id: current.id };
            throw Error("Probe already active");
          }
          if (
            !uuid.test(body.id) ||
            ![...positive, ...negative, ...app].includes(body.flow)
          )
            throw Error("Invalid probe");
          const entry = {
            ...createLedger(body.id, body.version, now),
            flow: body.flow,
            app_version: body.app_version,
            expires: now + 15 * 60_000,
          };
          await storage.put("probe", entry);
          await storage.setAlarm(entry.expires);
          return { correlation_id: entry.id };
        }
        if (
          body.op === "event" &&
          (!current || current.sealed || now >= current.expires)
        )
          return {};
        if (!current || now >= current.expires) throw Error("Probe expired");
        if (body.op === "event") {
          if (
            ["auth_attempt", "app_terminal"].includes(body.kind) &&
            (!uuid.test(body.app_version) ||
              body.app_version !== current.app_version)
          )
            throw Error("App version mismatch");
          if (Object.keys(current.events).length >= 64)
            throw Error("Probe observation limit");
          const updated = recordEvent(
            current,
            { id: body.id, kind: body.kind },
            now,
          );
          await storage.put("probe", updated);
          return {
            active: true,
            inject_failure: current.flow === "hook_failure_no_fallback",
          };
        }
        if (body.op === "read") {
          if (
            !current.sealed ||
            current.id !== body.id ||
            current.flow !== body.flow ||
            current.version !== body.version ||
            !current.receipt
          )
            throw Error("Sealed probe evidence unavailable");
          return current.receipt;
        }
        if (body.op !== "seal" || current.id !== body.id || current.sealed)
          throw Error("Invalid seal");
        if (app.includes(current.flow)) {
          const { ledger, receipt } = sealNegative(current, now);
          await storage.put("probe", ledger);
          return receipt;
        }
        const count = (kind) =>
          Object.values(current.events).filter((event) => event === kind)
            .length;
        const hook = count("hook_invocation");
        const provider = count("provider_attempt");
        const passed = positive.includes(current.flow)
          ? provider > 0 &&
            count("provider_success") > 0 &&
            count("link_verified") > 0
          : provider === 0 &&
            count(
              current.flow === "hook_failure_no_fallback"
                ? "hook_failure"
                : current.flow === "unsupported_action"
                  ? "unsupported_action"
                  : "recipient_denied",
            ) > 0;
        if (hook === 0 || !passed) throw Error("Incomplete hook evidence");
        const receipt = {
          status: "passed",
          hook_calls: hook,
          provider_calls: provider,
          correlation_id: current.id,
        };
        await storage.put("probe", { ...current, sealed: true, receipt });
        return receipt;
      });
      return send(result);
    } catch {
      return send({}, 409);
    }
  }

  async alarm() {
    await this.storage.transaction(async (storage) => {
      const current = await storage.get("probe");
      if (current && Date.now() < current.expires)
        await storage.setAlarm(current.expires);
      else if (current) await storage.delete("probe");
    });
  }
}
