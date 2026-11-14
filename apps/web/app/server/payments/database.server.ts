import { Client } from "pg";
export interface MoneyAttempt {
  id: string;
  hold_id: string;
  booking_id: string;
  reference: string;
  amount_minor: string | number;
  currency: "ZAR";
  subaccount: string;
  state: string;
  checkout_url: string | null;
  hold_expires_at: string;
  dispatch: boolean;
}
export interface MoneyEvent {
  event_key: string;
  reference: string;
  kind: string;
  provider_id: string;
  amount_minor: string | number;
  currency: string;
  status: string;
}
export function moneyDatabase(connectionString: string) {
  async function connection<T>(
    work: (client: Client) => Promise<T>,
  ): Promise<T> {
    const client = new Client({
      connectionString,
      application_name: "carworx-money",
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
      query_timeout: 5500,
    });
    try {
      await client.connect();
      return await work(client);
    } catch {
      throw new Error("payment_database_unavailable");
    } finally {
      await client.end().catch(() => undefined);
    }
  }
  async function scalar<T>(sql: string, args: unknown[]): Promise<T> {
    return connection(async (c) => {
      const r = await c.query<{ value: T }>(sql, args);
      const row = r.rows[0];
      if (row === undefined) throw new Error("payment_database_unavailable");
      return row.value;
    });
  }
  return {
    settlementPage() {
      return scalar<number | null>(
        "select private.settlement_list_page() as value",
        [],
      );
    },
    settlementList(page: number, rows: unknown[]) {
      return scalar<unknown>(
        "select private.record_settlement_list($1,$2::jsonb) as value",
        [page, JSON.stringify(rows)],
      );
    },
    claimSettlement() {
      return scalar<{ id: string; page: number; lease: string } | null>(
        "select private.claim_settlement() as value",
        [],
      );
    },
    settlementTransactions(
      id: string,
      page: number,
      lease: string,
      rows: unknown[],
    ) {
      return scalar<unknown>(
        "select private.record_settlement_page($1,$2,$3,$4::jsonb) as value",
        [id, page, lease, JSON.stringify(rows)],
      );
    },
    prepareNotifications() {
      return scalar<unknown>(
        "select private.prepare_booking_notifications() as value",
        [],
      );
    },
    notifications() {
      return connection(
        async (c) =>
          (
            await c.query<{
              logical_key: string;
              booking_id: string;
              email: string;
              expires_at: Date | string;
            }>("select * from private.pending_booking_notifications()")
          ).rows,
      );
    },
    finishNotification(key: string, state: "queued" | "suppressed") {
      return scalar<unknown>(
        "select private.finish_booking_notification($1,$2) as value",
        [key, state],
      );
    },
    recovery() {
      return connection(
        async (c) =>
          (
            await c.query<MoneyAttempt>(
              "select id,hold_id,booking_id,reference,amount_minor,currency,subaccount,state,checkout_url,hold_expires_at from private.payment_recovery_batch()",
            )
          ).rows,
      );
    },
    flag(attempt: string, kind: string) {
      return scalar<unknown>("select private.flag_payment($1,$2) as value", [
        attempt,
        kind,
      ]);
    },
    claimRefunds() {
      return connection(
        async (c) =>
          (
            await c.query<{
              id: string;
              reference: string;
              amount_minor: string;
            }>("select * from private.claim_refunds()")
          ).rows,
      );
    },
    refundRecovery() {
      return connection(
        async (c) =>
          (
            await c.query<{
              id: string;
              reference: string;
              provider_id: string | null;
              amount_minor: string;
            }>("select * from private.refund_recovery_batch()")
          ).rows,
      );
    },
    recordRefund(id: string, provider: string, amount: number, status: string) {
      return scalar<unknown>(
        "select private.record_refund($1,$2,$3,$4) as value",
        [id, provider, amount, status],
      );
    },
    refundIdentity(provider: string) {
      return scalar<string | null>(
        "select private.refund_identity($1) as value",
        [provider],
      );
    },
    adjustment(
      key: string,
      reference: string,
      provider: string,
      amount: number,
      state: string,
      refund: string | null,
    ) {
      return scalar<unknown>(
        "select private.apply_verified_adjustment($1,$2,$3,$4,$5,$6) as value",
        [key, reference, provider, amount, state, refund],
      );
    },
    prepare(hold: string, user: string) {
      return scalar<MoneyAttempt>(
        "select private.prepare_payment($1,$2) as value",
        [hold, user],
      );
    },
    saveCheckout(attempt: string, url: string) {
      return scalar<unknown>("select private.save_checkout($1,$2) as value", [
        attempt,
        url,
      ]);
    },
    enqueue(e: MoneyEvent) {
      return scalar<unknown>(
        "select private.enqueue_payment_event($1,$2,$3,$4,$5,$6,$7) as value",
        [
          e.event_key,
          e.reference,
          e.kind,
          e.provider_id,
          e.amount_minor,
          e.currency,
          e.status,
        ],
      );
    },
    pending() {
      return connection(
        async (c) =>
          (
            await c.query<MoneyEvent>(
              "select event_key,reference,kind,provider_id,amount_minor,currency,status from private.pending_payment_events()",
            )
          ).rows,
      );
    },
    defer(key: string) {
      return scalar<unknown>(
        "select private.defer_payment_event($1) as value",
        [key],
      );
    },
    async applyCharge(
      key: string,
      payment: {
        reference: string;
        providerId: string;
        amountMinor: number;
        currency: string;
      },
    ): Promise<void> {
      await connection(async (c) => {
        await c.query("begin");
        try {
          const stage = await c.query<{ value: unknown }>(
            "select private.stage_verified_charge($1,$2,$3,$4,$5) as value",
            [
              key,
              payment.reference,
              payment.providerId,
              payment.amountMinor,
              payment.currency,
            ],
          );
          const raw = stage.rows[0]?.value;
          if (typeof raw !== "object" || raw === null)
            throw new Error("payment_database_unavailable");
          const s = raw as Record<string, unknown>;
          if (s["duplicate"] === true)
            await c.query("select private.ack_duplicate_payment($1)", [key]);
          else {
            if (
              typeof s["hold_id"] !== "string" ||
              typeof s["attempt_id"] !== "string"
            )
              throw new Error("payment_database_unavailable");
            // This call executes as money_server WITH INHERIT booking_contract.
            const result = await c.query<{ outcome: string }>(
              "select private.confirm_paid($1,$2) as outcome",
              [s["hold_id"], s["attempt_id"]],
            );
            await c.query("select private.finish_charge_effect($1,$2,$3,$4)", [
              key,
              s["attempt_id"],
              payment.providerId,
              result.rows[0]?.outcome,
            ]);
          }
          await c.query("commit");
        } catch {
          await c.query("rollback").catch(() => undefined);
          throw new Error("payment_database_unavailable");
        }
      });
    },
  };
}
