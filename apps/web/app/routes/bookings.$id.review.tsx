import { data, Form } from "react-router";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import { Button, ButtonLink } from "../ui/Button";
import { throwStatus } from "../auth/http.server";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/bookings.$id.review";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const a = await requireSignedIn(request, context.security);
  a.headers.set("Cache-Control", "private, no-store");
  if (!UUID.test(params.id)) throwStatus(404, a.headers);
  const r = await a.supabase.rpc("my_booking_review", { p_booking: params.id });
  return data(
    {
      exists: r.error === null && r.data !== null,
      csrf: context.security.csrfToken,
      id: params.id,
    },
    { headers: a.headers },
  );
}
export async function action({ request, params, context }: Route.ActionArgs) {
  const a = await requireSignedIn(request, context.security);
  a.headers.set("Cache-Control", "private, no-store");
  const f = await request.formData(),
    stars = f.get("stars"),
    text = f.get("text");
  if (
    !UUID.test(params.id) ||
    typeof stars !== "string" ||
    !/^[1-5]$/.test(stars) ||
    typeof text !== "string" ||
    text.trim().length === 0 ||
    text.length > 2000
  )
    return data({ ok: false }, { status: 400, headers: a.headers });
  const r = await a.supabase.rpc("submit_booking_review", {
    p_booking: params.id,
    p_stars: Number(stars),
    p_text: text.trim(),
  });
  return data(
    { ok: r.error === null },
    { status: r.error === null ? 200 : 409, headers: a.headers },
  );
}
export default function Review({
  loaderData: d,
  actionData: a,
}: Route.ComponentProps) {
  return (
    <PublicShell signedIn>
      <h1>Review your completed booking</h1>
      <p>
        One review per completed booking. Leave out names, phone numbers,
        addresses and vehicle identifiers. Reviews are moderated before
        publication.
      </p>
      {d.exists || a?.ok ? (
        <p role="status">Your review has been submitted.</p>
      ) : (
        <Form method="post" className="grid gap-3">
          <CsrfField token={d.csrf} />
          <label>
            Rating
            <select name="stars" required defaultValue="">
              <option value="" disabled>
                Choose a rating
              </option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} of 5
                </option>
              ))}
            </select>
          </label>
          <label>
            Your experience
            <textarea name="text" maxLength={2000} required />
          </label>
          <Button type="submit" variant="primary">
            Submit for moderation
          </Button>
        </Form>
      )}
      {a?.ok === false ? (
        <p role="alert">
          The review could not be submitted. Only your own completed booking can
          be reviewed once.
        </p>
      ) : null}
      <ButtonLink href={"/bookings/" + d.id} variant="outline">
        Back to booking
      </ButtonLink>
    </PublicShell>
  );
}
