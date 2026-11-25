/**
 * /account/closing: what a closing account sees after signing back in
 * within its 14 days (D-098, owner 2026-11-24). Nothing is restored
 * silently: the person confirms "Reinstate my account", or keeps it closed
 * and signs out. Ended team memberships are not restored.
 */
import { data } from "react-router";

import { throwRedirect } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import { Button } from "../ui/Button";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import "../account/settings.css";
import type { Route } from "./+types/account.closing";

export const meta: Route.MetaFunction = () => [
  { title: "Your account is closing · CarworX" },
  { name: "robots", content: "noindex" },
];

function sastDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat("en-ZA", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Africa/Johannesburg",
      }).format(date);
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  signedIn.headers.set("Cache-Control", "private, no-store");
  if (signedIn.closingUntil === null)
    return throwRedirect("/account/profile", signedIn.headers);
  return data(
    {
      csrf: context.security.csrfToken,
      on:
        signedIn.closingUntil === "unknown"
          ? null
          : sastDate(signedIn.closingUntil),
      unknown: signedIn.closingUntil === "unknown",
      // Past the 14 days: still signed out, but no longer reinstatable.
      overdue:
        signedIn.closingUntil !== "unknown" &&
        Date.parse(signedIn.closingUntil) <= Date.now(),
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  signedIn.headers.set("Cache-Control", "private, no-store");
  const form = await request.formData();
  if (form.get("intent") !== "reinstate")
    return data({ problem: true }, { status: 400, headers: signedIn.headers });
  const result = await signedIn.supabase.rpc("reinstate_account");
  if (result.error !== null || result.data !== true)
    return data({ problem: true }, { status: 409, headers: signedIn.headers });
  return throwRedirect("/account/profile?reinstated=1", signedIn.headers);
}

export default function Closing({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <PublicShell signedIn>
      <div className="cx-account-settings">
        <section className="cx-account-box" data-closing>
          <h1 className="type-heading">Your account is closing</h1>
          {loaderData.unknown ? (
            <StatusNote tone="err" title="We couldn't check your account.">
              Please try again in a moment.
            </StatusNote>
          ) : loaderData.overdue ? (
            <p data-overdue>
              The 14 days have passed, so your CarworX account is being deleted.
              It can no longer be reinstated. We'll email you when it's done.
            </p>
          ) : (
            <p>
              {`You asked us to delete your CarworX account. It will be deleted on ${loaderData.on ?? "the date we emailed you"}. Until then your data is kept, and you can keep your account.`}
            </p>
          )}
          {actionData?.problem ? (
            <StatusNote tone="err" title="That didn't work.">
              Your account can no longer be reinstated, or the request was
              invalid.
            </StatusNote>
          ) : null}
          {loaderData.overdue ? null : (
            <>
              <p className="type-caption">
                If you keep it, you will need new invites to rejoin any team you
                were part of.
              </p>
              <form method="post">
                <CsrfField token={loaderData.csrf} />
                <input type="hidden" name="intent" value="reinstate" />
                <Button type="submit" variant="primary">
                  Reinstate my account
                </Button>
              </form>
            </>
          )}
          <form method="post" action="/auth/sign-out">
            <CsrfField token={loaderData.csrf} />
            <Button type="submit" variant="outline">
              Keep it closed and sign out
            </Button>
          </form>
        </section>
      </div>
    </PublicShell>
  );
}
