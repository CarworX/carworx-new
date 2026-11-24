import { data, Form, Link } from "react-router";

import { field } from "../auth/forms";
import { throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  rpc,
  STATE_COPY,
  UUID,
  when,
  type BookingState,
} from "../server/bookings/shared";
import { Button } from "../ui/Button";
import { StatusLabel } from "../ui/Chip";
import { EmptyState, StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/provider.jobs";

export const meta: Route.MetaFunction = () => [{ title: "My jobs · CarworX" }];

interface Job {
  booking_id: string;
  starts_at: string;
  ends_at: string;
  state: BookingState;
  suburb: string | null;
  mobile: boolean;
}

/**
 * /provider/jobs: the signed-in staff member's assigned jobs. A mobile
 * job's full address is shown only on request (POST), only to assigned
 * staff or the business's managers, and every read is logged (A31).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const res = await rpc(signedIn.supabase, "my_jobs");
  if (res.error !== null) throwStatus(503, signedIn.headers);
  return data(
    { csrf: context.security.csrfToken, jobs: res.data as Job[] },
    { headers: signedIn.headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const form = await request.formData();
  const booking = field(form, "booking");
  if (!UUID.test(booking))
    return data(
      { booking: null, address: null, failed: true },
      { status: 400, headers: signedIn.headers },
    );
  const res = await rpc(signedIn.supabase, "job_address", {
    p_booking: booking,
  });
  const row = (
    res.data as { address: string; access_notes: string | null }[] | null
  )?.[0];
  if (res.error !== null || !row)
    return data(
      { booking, address: null, failed: true },
      {
        status: res.error?.code === "42501" ? 403 : 404,
        headers: signedIn.headers,
      },
    );
  return data(
    { booking, address: row, failed: false },
    { headers: signedIn.headers },
  );
}

export default function Jobs({ loaderData, actionData }: Route.ComponentProps) {
  const { csrf, jobs } = loaderData;
  return (
    <PublicShell signedIn>
      <div className="grid max-w-[70ch] gap-5">
        <h1 className="type-title">My jobs</h1>
        {jobs.length === 0 ? (
          <EmptyState title="No jobs assigned">
            When a manager assigns you a booking it shows here.
          </EmptyState>
        ) : (
          <ul className="grid gap-3">
            {jobs.map((j) => (
              <li
                key={j.booking_id}
                className="grid gap-2 rounded-2xl bg-[var(--surface)] p-4"
                data-booking={j.booking_id}
              >
                <p className="type-body">
                  <b>{when(j.starts_at)}</b>{" "}
                  <StatusLabel tone={STATE_COPY[j.state].tone}>
                    {STATE_COPY[j.state].label}
                  </StatusLabel>
                  {j.mobile ? ` · ${j.suburb ?? ""}` : ""}
                </p>
                {j.mobile ? (
                  actionData?.booking === j.booking_id && actionData.address ? (
                    <StatusNote title={actionData.address.address}>
                      {actionData.address.access_notes ?? "No access notes."}{" "}
                      This view is logged.
                    </StatusNote>
                  ) : (
                    <Form method="post">
                      <CsrfField token={csrf} />
                      <input
                        type="hidden"
                        name="booking"
                        value={j.booking_id}
                      />
                      <Button type="submit" variant="outline">
                        Show address
                      </Button>
                    </Form>
                  )
                ) : null}
                {actionData?.booking === j.booking_id && actionData.failed ? (
                  <StatusNote tone="err" title="Address not available.">
                    You are no longer assigned, or the job is closed.
                  </StatusNote>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link to="/provider/bookings" className="cx-tlink">
            Bookings
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
