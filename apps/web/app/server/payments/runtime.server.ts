import { readServerConfig } from "../security/config";
import { readPaystackConfig, createPaystack } from "./paystack.server";
import { moneyDatabase } from "./database.server";
import {
  authenticPaystack,
  rawPaystackBody,
  chargeEvent,
  stableEventKey,
} from "./webhook.server";
export const PAYMENT_WEBHOOK_PATH = "/api/payments/paystack";
export function paymentRuntime(env: unknown) {
  try {
    const security = readServerConfig(env),
      config = readPaystackConfig(env, security),
      vars = (env ?? {}) as Record<string, unknown>;
    const binding = vars["MONEY_DB"] as
      { connectionString?: unknown } | undefined;
    if (
      config === null ||
      typeof binding?.connectionString !== "string" ||
      binding.connectionString.length === 0
    )
      return null;
    return {
      security,
      config,
      db: moneyDatabase(binding.connectionString),
      provider: createPaystack(config),
      signingSecret:
        typeof vars["PAYSTACK_WEBHOOK_SECRET"] === "string"
          ? vars["PAYSTACK_WEBHOOK_SECRET"]
          : undefined,
    };
  } catch {
    return null;
  }
}
function response(status: number) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    },
  });
}
export async function dispatchPaymentWebhook(
  request: Request,
  env: unknown,
): Promise<Response> {
  if (new URL(request.url).pathname !== PAYMENT_WEBHOOK_PATH)
    return response(404);
  if (request.method !== "POST") return response(405);
  const ready = paymentRuntime(env);
  if (ready === null) return response(503);
  if (new URL(request.url).origin !== ready.security.appOrigin)
    return response(404);
  try {
    const raw = await rawPaystackBody(request);
    if (raw === null) return response(413);
    if (
      !(await authenticPaystack(
        raw,
        request.headers,
        ready.config.secret,
        ready.signingSecret,
      ))
    )
      return response(401);
    const event = await chargeEvent(raw);
    if (event === null) return response(400);
    if (event === "ignored") return response(200);
    // Await the committed durable insert before acknowledging. No inline payment effect.
    await ready.db.enqueue(event);
    return response(200);
  } catch {
    return response(503);
  }
}

export async function drainPaymentEvents(env: unknown): Promise<void> {
  const ready = paymentRuntime(env);
  if (ready === null) return;
  for (const event of await ready.db.pending()) {
    try {
      const verified = await ready.provider.verify(event.reference);
      if (verified.status !== "success" || verified.currency !== event.currency)
        throw new Error("payment_verification_invalid");
      if (event.kind === "charge.success") {
        if (
          verified.providerId !== event.provider_id ||
          verified.amountMinor !== Number(event.amount_minor)
        )
          throw new Error("payment_verification_invalid");
        await ready.db.applyCharge(event.event_key, verified);
      } else if (event.kind.startsWith("refund.")) {
        const refundId = await ready.db.refundIdentity(event.provider_id);
        if (refundId === null)
          throw new Error("refund_reconciliation_required");
        const refund = await ready.provider.refundStatus(event.provider_id, {
          ...verified,
          amountMinor: Number(event.amount_minor),
          refundId,
        });
        await ready.db.adjustment(
          event.event_key,
          event.reference,
          refund.providerId,
          refund.amountMinor,
          refund.status,
          refundId,
        );
      } else {
        const dispute = await ready.provider.disputeStatus(
          event.provider_id,
          verified,
        );
        if (dispute.amountMinor !== Number(event.amount_minor))
          throw new Error("payment_verification_invalid");
        await ready.db.adjustment(
          event.event_key,
          event.reference,
          dispute.providerId,
          dispute.amountMinor,
          dispute.state,
          null,
        );
      }
    } catch {
      await ready.db.defer(event.event_key);
    }
  }
}
export async function reconcilePayments(env: unknown): Promise<void> {
  const ready = paymentRuntime(env);
  if (ready === null) return;
  for (const attempt of await ready.db.recovery()) {
    try {
      const v = await ready.provider.verify(attempt.reference);
      if (
        v.amountMinor !== Number(attempt.amount_minor) ||
        v.currency !== attempt.currency
      ) {
        await ready.db.flag(attempt.id, "verification_mismatch");
        continue;
      }
      if (v.status === "success") {
        const e = {
          event_key: await stableEventKey(
            "charge.success",
            v.providerId,
            "success",
          ),
          reference: v.reference,
          provider_id: v.providerId,
          amount_minor: v.amountMinor,
          currency: v.currency,
          kind: "charge.success",
          status: "success",
        };
        await ready.db.enqueue(e);
        await ready.db.applyCharge(e.event_key, v);
      } else if (v.status === "reversed")
        await ready.db.flag(attempt.id, "verification_mismatch");
    } catch {
      await ready.db.flag(attempt.id, "provider_unavailable");
    }
  }
  for (const r of await ready.db.claimRefunds()) {
    try {
      const v = await ready.provider.refund(
        r.reference,
        Number(r.amount_minor),
        r.id,
      );
      // A successful request still requires a verified GET before final effects.
      const charge = await ready.provider.verify(r.reference);
      const refund = await ready.provider.refundStatus(v.providerId, {
        ...charge,
        amountMinor: Number(r.amount_minor),
        refundId: r.id,
      });
      await ready.db.recordRefund(
        r.id,
        refund.providerId,
        refund.amountMinor,
        refund.status,
      );
    } catch {
      /* Submission remains durable and becomes reconcile, never blindly resubmitted. */
    }
  }
  for (const r of await ready.db.refundRecovery()) {
    try {
      const charge = await ready.provider.verify(r.reference),
        expected = {
          ...charge,
          amountMinor: Number(r.amount_minor),
          refundId: r.id,
        };
      const refund =
        r.provider_id === null
          ? await ready.provider.recoverRefund(expected)
          : await ready.provider.refundStatus(r.provider_id, expected);
      await ready.db.recordRefund(
        r.id,
        refund.providerId,
        refund.amountMinor,
        refund.status,
      );
    } catch {
      /* Fixed outstanding state is visible in admin operations. */
    }
  }
}

/** Durable page cursors cover the account, without retaining provider customer objects. */
export async function reconcileSettlements(env: unknown): Promise<void> {
  const ready = paymentRuntime(env);
  if (ready === null) return;
  const page = await ready.db.settlementPage();
  if (page !== null)
    try {
      await ready.db.settlementList(
        page,
        await ready.provider.settlements(page),
      );
    } catch {
      /* Cursor remains on this page for the next run. */
    }
  const job = await ready.db.claimSettlement();
  if (job === null) return;
  const rows = await ready.provider.settlementTransactions(job.id, job.page);
  await ready.db.settlementTransactions(job.id, job.page, job.lease, rows);
}
