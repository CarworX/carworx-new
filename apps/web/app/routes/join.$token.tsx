import { data } from "react-router";

import { field } from "../auth/forms";
import { throwRedirect } from "../auth/http.server";
import { authRequest, getSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import { INVITE_TOKEN, TEAM_PROBLEMS } from "../team/forms";
import {
  clearInviteCookie,
  inviteCookie,
  pendingInvite,
} from "../team/invite.server";
import { privateHeaders } from "../team/server";
import { Button, ButtonLink } from "../ui/Button";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
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
  return throwRedirect("/provider?done=1", headers);
}

export default function Join({ loaderData, actionData }: Route.ComponentProps) {
  const problem =
    actionData?.problem ?? (!loaderData.hasInvite ? "invite_invalid" : null);
  return (
    <PublicShell signedIn={loaderData.signedIn}>
      <div className="mx-auto grid max-w-[620px] gap-5">
        <p className="type-label text-quiet">Your team</p>
        <h1 className="type-display-lg">Work together on CarworX.</h1>
        <p className="type-body">
          Use your own account. This invite gives access to a business; it never
          shares someone else’s sign-in.
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
            <div>
              <ButtonLink href="/auth/sign-in?returnTo=%2Fjoin" arrow>
                Sign in to join
              </ButtonLink>
            </div>
            <p className="type-caption">
              New here?{" "}
              <a className="cx-tlink" href="/auth/sign-up">
                Create your account
              </a>
              , then reopen the original invite link.
            </p>
          </>
        )}
        <a className="cx-tlink" href="/provider">
          Your business home
        </a>
      </div>
    </PublicShell>
  );
}
