import type { AppLoadContext } from "react-router";
import { canonicalEmail } from "../server/security/recipient-policy";

const encode = (value: string) => new TextEncoder().encode(value);
const hex = (value: ArrayBuffer) =>
  Array.from(new Uint8Array(value), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
type Flow = "signup" | "resend" | "recovery";
type Kind = "app_terminal" | "auth_attempt";

export async function observeEmailProbe(
  request: Request,
  context: AppLoadContext,
  email: string,
  flow: Flow,
  kind: Kind,
): Promise<void> {
  const header = request.headers.get("x-carworx-app-probe");
  if (!header) return;
  const env = context.cloudflare.env as unknown as Record<string, unknown>;
  const key = env["STAGING_PROBE_EVENT_KEY"];
  if (
    env["CARWORX_ENV"] !== "staging" ||
    typeof key !== "string" ||
    key.length < 32
  )
    return;
  const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(header);
  const address = canonicalEmail(email);
  if (!match || !address || Math.abs(Date.now() - Number(match[1])) > 30_000)
    return;
  const timestamp = match[1] ?? "";
  const signature = match[2] ?? "";
  const hmac = await crypto.subtle.importKey(
    "raw",
    encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const recipient = hex(
    await crypto.subtle.sign(
      "HMAC",
      hmac,
      encode("carworx-probe-recipient-v1\n" + address),
    ),
  );
  const message = `carworx-app-probe-v1\n${timestamp}\n${flow}\n${recipient}`;
  if (
    !(await crypto.subtle.verify(
      "HMAC",
      hmac,
      Uint8Array.from(signature.match(/../g) ?? [], (pair) =>
        Number.parseInt(pair, 16),
      ),
      encode(message),
    ))
  )
    return;
  const origin = env["STAGING_PROBE_ORIGIN"];
  const version = env["STAGING_WORKER_VERSION"] as { id?: unknown } | undefined;
  if (typeof origin !== "string" || typeof version?.id !== "string")
    throw Error("Probe configuration unavailable");
  const target = new URL(origin);
  if (
    target.protocol !== "https:" ||
    target.origin !== origin ||
    target.origin === new URL(request.url).origin
  )
    throw Error("Probe destination unavailable");
  const body = JSON.stringify({
    op: "event",
    kind,
    recipient,
    id: crypto.randomUUID(),
    app_version: version.id,
  });
  const stamp = String(Date.now());
  const signed = await crypto.subtle.sign(
    "HMAC",
    hmac,
    encode(`carworx-probe-v1\napp\n${stamp}\n${body}`),
  );
  const response = await fetch(new URL("/_ops/probe", target), {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      "x-carworx-probe-role": "app",
      "x-carworx-probe-time": stamp,
      "x-carworx-probe-signature": hex(signed),
    },
    body,
    signal: AbortSignal.timeout(1_500),
  });
  await response.body?.cancel();
  if (!response.ok) throw Error("Probe observation failed");
}
