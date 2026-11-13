import { data, Form, Link } from "react-router";

import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  BOOKING_PROBLEM_TEXT,
  bookingProblem,
  parseIntIn,
  parseOptionalText,
  parseText,
  rand,
  rpc,
  UUID,
  when,
  type BookingProblem,
} from "../server/bookings/shared";
import { field } from "../auth/forms";
import { Receipt } from "../ui/Booking";
import { Button } from "../ui/Button";
import { StatusLabel } from "../ui/Chip";
import { TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/provider.quotes.$id";

export const meta: Route.MetaFunction = () => [
  { title: "Quote · Your business · CarworX" },
];

const LINE_ROWS = 6;

interface Quote {
  id: string;
  state: string;
  customer_note: string | null;
  parent_booking_id: string | null;
  created_at: string;
}
interface Version {
  id: string;
  version: number;
  lines: { label: string; amount_minor: number }[];
  total_minor: number;
  duration_minutes: number;
  valid_until: string;
  note: string | null;
  state: string;
}

/**
 * /provider/quotes/:id: a manager writes a priced quote. Each send is a new
 * immutable version; sending again supersedes the last one and releases any
 * unpaid hold on it (A22).
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  if (!UUID.test(params.id)) throwStatus(404, signedIn.headers);
  const db = signedIn.supabase;
  const [q, v] = await Promise.all([
    db
      .from("quotes")
      .select("id, state, customer_note, parent_booking_id, created_at")
      .eq("id", params.id)
      .maybeSingle<Quote>(),
    db
      .from("quote_versions")
      .select(
        "id, version, lines, total_minor, duration_minutes, valid_until, note, state",
      )
      .eq("quote_id", params.id)
      .order("version", { ascending: false })
      .overrideTypes<Version[], { merge: false }>(),
  ]);
  if (q.error !== null || v.error !== null) throwStatus(503, signedIn.headers);
  if (q.data === null) throwStatus(404, signedIn.headers);
  return data(
    { csrf: context.security.csrfToken, quote: q.data, versions: v.data },
    { headers: signedIn.headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  if (!UUID.test(params.id)) throwStatus(404, signedIn.headers);
  const form = await request.formData();
  const fail = (problem: BookingProblem) =>
    data(
      { problem },
      {
        status: problem === "unavailable" ? 503 : 400,
        headers: signedIn.headers,
      },
    );
  const lines: { label: string; amount_minor: number }[] = [];
  for (let i = 0; i < LINE_ROWS; i++) {
    const label = field(form, `label_${String(i)}`).trim();
    const amount = field(form, `amount_${String(i)}`)
      .trim()
      .replace(/\s/g, "")
      .replace(",", ".");
    if (label === "" && amount === "") continue;
    const okLabel = parseText(form, `label_${String(i)}`, 2, 80);
    if (okLabel === null || !/^\d{1,7}(\.\d{1,2})?$/.test(amount))
      return fail("invalid_input");
    lines.push({
      label: okLabel,
      amount_minor: Math.round(Number(amount) * 100),
    });
  }
  if (lines.length === 0) return fail("invalid_input");
  const duration = parseIntIn(form, "duration", 15, 1440);
  const valid = parseIntIn(form, "valid_days", 1, 30);
  const note = parseOptionalText(form, "note", 1000);
  if (
    duration === null ||
    duration % 15 !== 0 ||
    valid === null ||
    note === false
  )
    return fail("invalid_input");
  const { error } = await rpc(signedIn.supabase, "issue_quote_version", {
    p_quote: params.id,
    p_lines: lines,
    p_duration: duration,
    p_valid_days: valid,
    p_note: note,
  });
  if (error !== null) return fail(bookingProblem(error));
  return throwRedirect(`/provider/quotes/${params.id}`, signedIn.headers);
}

export default function ProviderQuote({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { csrf, quote, versions } = loaderData;
  const latest = versions[0];
  const open = ["requested", "quoted", "approved"].includes(quote.state);
  return (
    <PublicShell signedIn>
      <div className="grid max-w-[70ch] gap-5" data-quote-state={quote.state}>
        <h1 className="type-title">
          {quote.parent_booking_id ? "Quote extra work" : "Write a quote"}
        </h1>
        <p className="type-caption">Asked {when(quote.created_at)}</p>
        {quote.customer_note ? (
          <p className="type-body">“{quote.customer_note}”</p>
        ) : null}
        {actionData?.problem ? (
          <StatusNote tone="err" title="That didn't work.">
            {BOOKING_PROBLEM_TEXT[actionData.problem]}
          </StatusNote>
        ) : null}
        {versions.map((v) => (
          <Receipt
            key={v.id}
            title={`v${String(v.version)}`}
            lines={v.lines.map((l) => ({
              label: l.label,
              amount: rand(l.amount_minor),
              old: v.state === "superseded",
            }))}
            total={{
              label: "Total",
              amount: rand(v.total_minor),
              old: v.state === "superseded",
            }}
            stamp={
              <StatusLabel tone={v.state === "issued" ? "warn" : "info"}>
                {v.state === "issued"
                  ? `Sent, valid until ${when(v.valid_until)}`
                  : v.state}
              </StatusLabel>
            }
          />
        ))}
        {open ? (
          <Form method="post" className="grid gap-3">
            <CsrfField token={csrf} />
            <h2 className="type-label">
              {latest
                ? `Send v${String(latest.version + 1)} (replaces v${String(latest.version)})`
                : "Send the first version"}
            </h2>
            {Array.from({ length: LINE_ROWS }, (_, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3">
                <TextField
                  label={`Line ${String(i + 1)}`}
                  name={`label_${String(i)}`}
                  maxLength={80}
                  defaultValue={latest?.lines[i]?.label ?? ""}
                  required={i === 0}
                />
                <TextField
                  label="Amount (R)"
                  name={`amount_${String(i)}`}
                  inputMode="decimal"
                  defaultValue={
                    latest?.lines[i]
                      ? (latest.lines[i].amount_minor / 100).toFixed(2)
                      : ""
                  }
                  required={i === 0}
                />
              </div>
            ))}
            <TextField
              label="Time needed (minutes, steps of 15)"
              name="duration"
              inputMode="numeric"
              defaultValue={String(latest?.duration_minutes ?? 60)}
              required
            />
            <TextField
              label="Valid for (days, 1 to 30)"
              name="valid_days"
              inputMode="numeric"
              defaultValue="7"
              required
            />
            <TextField
              label="Note to the customer (optional)"
              name="note"
              maxLength={1000}
            />
            <div>
              <Button type="submit" variant="primary">
                Send quote
              </Button>
            </div>
          </Form>
        ) : null}
        <p>
          <Link to="/provider/bookings" className="cx-tlink">
            Back to bookings
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
