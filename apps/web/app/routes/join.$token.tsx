import { data } from "react-router";

import { field } from "../auth/forms";
import { throwRedirect } from "../auth/http.server";
import {
  authRequest,
  getSignedIn,
  signedInWithPendingTerms,
  termsUrl,
} from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import { UUID } from "../server/providers/forms";
import { INVITE_TOKEN, TEAM_PROBLEMS } from "../team/forms";
import {
  clearInviteCookie,
  inviteCookie,
  pendingInvite,
} from "../team/invite.server";
import { privateHeaders } from "../team/server";
import { Button, ButtonLink } from "../ui/Button";
import { StatusNote } from "../ui/Note";
import { Icon } from "../ui/Icon";
import { PublicShell } from "../ui/public/PublicShell";
import "../team/setup.css";
import type { Route } from "./+types/join.$token";

export const meta: Route.MetaFunction = () => [
  { title: "Join your team · CarworX" },
];

/** No invite lookup or account data is exposed before the person's own sign-in. */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  if (params.token !== undefined) {
    const headers = privateHeaders(new Headers());
    headers.append(
      "Set-Cookie",
      INVITE_TOKEN.test(params.token)
        ? inviteCookie(params.token)
        : clearInviteCookie(),
    );
    // Drop the secret before rendering any page, following links or starting OAuth.
    return throwRedirect("/join", headers);
  }
  // A signed-in person with pending account terms accepts the terms first, then
  // comes back here to join (B-10 2b).
  const pending = await signedInWithPendingTerms(request, context.security);
  if (pending !== null)
    throwRedirect(
      termsUrl(request, pending.config.appOrigin, "/join"),
      pending.headers,
    );
  const signedIn = await getSignedIn(request, context.security);
  const headers = privateHeaders(signedIn?.headers ?? new Headers());
  return data(
    {
      csrf: context.security.csrfToken,
      signedIn: signedIn !== null,
      hasInvite: pendingInvite(request) !== null,
    },
    { headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const pending = await signedInWithPendingTerms(request, context.security);
  if (pending !== null)
    throwRedirect(
      termsUrl(request, pending.config.appOrigin, "/join"),
      pending.headers,
    );
  const signedIn = await getSignedIn(request, context.security);
  const headers = privateHeaders(
    signedIn?.headers ?? authRequest(request, context.security).headers,
  );
  const fail = (
    problem: "invite_invalid" | "already_member" | "unavailable",
  ) => {
    headers.append("Set-Cookie", clearInviteCookie());
    return data(
      { problem },
      { headers, status: problem === "unavailable" ? 503 : 400 },
    );
  };
  if (params.token !== undefined) return fail("invite_invalid");
  if (signedIn === null)
    return throwRedirect("/auth/sign-in?returnTo=%2Fjoin", headers);
  const token = pendingInvite(request);
  if (token === null || field(await request.formData(), "intent") !== "accept")
    return fail("invite_invalid");
  const result = await signedIn.supabase.rpc("accept_invite", {
    p_token: token,
  });
  if (result.error !== null) {
    if (result.error.message === "already_member")
      return fail("already_member");
    if (
      result.error.message === "invite_invalid" ||
      result.error.code === "42501"
    )
      return fail("invite_invalid");
    return fail("unavailable");
  }
  headers.append("Set-Cookie", clearInviteCookie());
  const business =
    typeof result.data === "string" && UUID.test(result.data)
      ? `#business-${result.data}`
      : "";
  return throwRedirect(`/provider?done=1${business}`, headers);
}

export default function Join({ loaderData, actionData }: Route.ComponentProps) {
  const problem =
    actionData?.problem ?? (!loaderData.hasInvite ? "invite_invalid" : null);
  return (
    <PublicShell signedIn={loaderData.signedIn}>
      <div className="cx-setup-flow cx-join-flow">
        <section className="cx-setup-card">
          <div>
            <p className="type-label text-quiet">Team invite</p>
            <h1 className="type-display-lg">Join your team</h1>
          </div>
          <p className="type-body">
            Use your own account. This invite gives access to a business; it
            never shares someone else’s sign-in.
          </p>
          {problem ? (
            <StatusNote tone="warn" title="We couldn't use this invite.">
              {TEAM_PROBLEMS[problem]}
            </StatusNote>
          ) : loaderData.signedIn ? (
            <form method="post" action="/join" className="grid gap-4">
              <CsrfField token={loaderData.csrf} />
              <input type="hidden" name="intent" value="accept" />
              <StatusNote title="Ready to join?">
                Accept only if you were expecting an invite from this business.
                The link works once and expires after seven days.
              </StatusNote>
              <div>
                <Button type="submit" variant="primary">
                  Accept invite
                </Button>
              </div>
            </form>
          ) : (
            <>
              <StatusNote title="Sign in with your own account.">
                For an email invite, use the account with that verified email
                address. This browser keeps the invite for ten minutes while you
                sign in.
              </StatusNote>
              <div className="cx-invite-options">
                <ButtonLink href="/auth/sign-in?returnTo=%2Fjoin" arrow>
                  Sign in to join
                </ButtonLink>
                <ButtonLink
                  href="/auth/sign-up?returnTo=%2Fjoin"
                  variant="outline"
                >
                  Create your account
                </ButtonLink>
              </div>
              <p className="type-caption flex items-start gap-2">
                <Icon name="lock" size="sm" />
                If the invitation expires while you confirm your email, reopen
                your original link.
              </p>
            </>
          )}
          <a className="cx-tlink" href="/provider">
            Your business home
          </a>
        </section>
      </div>
    </PublicShell>
  );
}
