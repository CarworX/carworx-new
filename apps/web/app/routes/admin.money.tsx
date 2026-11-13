import { data, Form } from "react-router";
import { requireAdmin } from "../server/providers/admin.server";
import { throwStatus } from "../auth/http.server";
import { CsrfField } from "../auth/ui";
import { Button } from "../ui/Button";
import { AdminShell } from "../ui/admin/AdminShell";
import type { Route } from "./+types/admin.money";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
type Row = Record<string, string | number>;
function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 100)
    .filter(
      (r): r is Row =>
        typeof r === "object" &&
        r !== null &&
        Object.values(r).every(
          (v) => typeof v === "string" || typeof v === "number",
        ),
    );
}
export async function loader({ request, context }: Route.LoaderArgs) {
  const a = await requireAdmin(request, context.security);
  a.headers.set("Cache-Control", "private, no-store");
  a.headers.set("Referrer-Policy", "no-referrer");
  const [money, mail, settlements] = await Promise.all([
    a.supabase.rpc("money_operations"),
    a.supabase.rpc("mail_operations"),
    a.supabase.rpc("settlement_operations"),
  ]);
  if (money.error !== null || mail.error !== null || settlements.error !== null)
    throwStatus(503, a.headers);
  const m = (money.data ?? {}) as Record<string, unknown>,
    q = (mail.data ?? {}) as Record<string, unknown>;
  return data(
    {
      settlements: rows(settlements.data),
      cases: rows(m["cases"]),
      refunds: rows(m["refunds"]),
      disputes: rows(m["disputes"]),
      used: typeof q["used"] === "number" ? q["used"] : 0,
      quotaAlert: q["quota_alert"] === true,
      reconcile: typeof q["reconcile"] === "number" ? q["reconcile"] : 0,
      csrf: context.security.csrfToken,
      key: crypto.randomUUID(),
    },
    { headers: a.headers },
  );
}
export async function action({ request, context }: Route.ActionArgs) {
  const a = await requireAdmin(request, context.security);
  a.headers.set("Cache-Control", "private, no-store");
  const f = await request.formData(),
    book = f.get("booking"),
    amount = f.get("amount"),
    reason = f.get("reason"),
    key = f.get("key");
  if (
    typeof book !== "string" ||
    !UUID.test(book) ||
    typeof amount !== "string" ||
    !/^[1-9][0-9]{0,15}$/.test(amount) ||
    !Number.isSafeInteger(Number(amount)) ||
    typeof reason !== "string" ||
    reason.trim().length < 3 ||
    reason.length > 500 ||
    typeof key !== "string" ||
    !UUID.test(key)
  )
    return data(
      { error: "Check the booking, amount in cents and reason.", ok: false },
      { status: 400, headers: a.headers },
    );
  const r = await a.supabase.rpc("request_payment_refund", {
    p_booking: book,
    p_amount: Number(amount),
    p_reason: reason.trim(),
    p_key: key,
  });
  return data(
    {
      error:
        r.error === null
          ? null
          : "Refund request could not be recorded. Check the payment and existing refunds.",
      ok: r.error === null,
    },
    { status: r.error === null ? 200 : 409, headers: a.headers },
  );
}
export default function Money({
  loaderData: d,
  actionData: a,
}: Route.ComponentProps) {
  const lists = [
    ["Settlements", d.settlements],
    ["Open reconciliation cases", d.cases],
    ["Refunds", d.refunds],
    ["Disputes", d.disputes],
  ] as const;
  return (
    <AdminShell title="Money and delivery">
      <p>Test mode · provider verification drives payment state.</p>
      <p role="status">
        Mail first attempts in 24 hours: {d.used}/100. Mail requiring
        reconciliation: {d.reconcile}.
      </p>
      {d.quotaAlert ? (
        <p role="alert">
          Mail quota reached. New sends are paused; do not bypass the queue.
        </p>
      ) : null}
      {lists.map(([title, items]) => (
        <section key={title} className="mt-6">
          <h2>{title}</h2>
          {items.length === 0 ? (
            <p>No records.</p>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <caption className="sr-only">{title}</caption>
                <thead>
                  <tr>
                    {Object.keys(items[0] ?? {}).map((k) => (
                      <th key={k} scope="col">
                        {k.replaceAll("_", " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, i) => (
                    <tr key={i}>
                      {Object.entries(row).map(([k, v]) => (
                        <td key={k} className="px-2 py-2">
                          {String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
      <section className="mt-8">
        <h2>Request a test refund</h2>
        <p>
          Amounts are in cents. A request does not mean the provider has
          processed the refund. Existing reservations reduce the refundable
          balance.
        </p>
        <Form method="post" className="grid gap-3">
          <CsrfField token={d.csrf} />
          <input type="hidden" name="key" value={d.key} />
          <label>
            Booking ID
            <input name="booking" required maxLength={36} />
          </label>
          <label>
            Amount in cents
            <input
              name="amount"
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              required
            />
          </label>
          <label>
            Reason
            <textarea name="reason" required minLength={3} maxLength={500} />
          </label>
          <Button type="submit" variant="primary">
            Record refund request
          </Button>
        </Form>
        {a?.error ? <p role="alert">{a.error}</p> : null}
        {a?.ok ? (
          <p role="status">
            Refund request recorded. Check its processing state above.
          </p>
        ) : null}
      </section>
      <p className="mt-6">
        <a href="/admin/reviews">Review moderation</a>
      </p>
    </AdminShell>
  );
}
