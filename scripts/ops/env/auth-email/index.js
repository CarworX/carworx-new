import { createAuthEmailHandler } from "./handler.js";
import { observeHook, probeEndpoint } from "./probe-runtime.js";
export { StagingProbe } from "./probe-runtime.js";

export async function deliverResend(message, env, idempotencyKey) {
  if (
    typeof env.STAGING_RESEND_API_KEY !== "string" ||
    env.STAGING_RESEND_API_KEY.length === 0
  )
    throw new Error("Delivery unavailable");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STAGING_RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(2000),
  });
  // Provider bodies may echo recipients; never log/return them or fall back to SMTP.
  void response.body?.cancel().catch(() => undefined);
  if (!response.ok) throw new Error("Delivery unavailable");
}

const hook = createAuthEmailHandler(deliverResend, { observe: observeHook });
export default {
  fetch(request, env) {
    return new URL(request.url).pathname === "/_ops/probe"
      ? probeEndpoint(request, env)
      : hook(request, env);
  },
};
