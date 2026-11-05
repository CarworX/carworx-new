import { data, Form, Link, redirect } from "react-router";

import { FAILURE_MESSAGES } from "../errors";
import { field } from "../forms";
import { authRequest } from "../session.server";
import { AuthPage, CsrfField, Notice } from "../ui";
import type { Route } from "./+types/confirm";

export const meta: Route.MetaFunction = () => [{ title: "Confirm · CarworX" }];

/**
 * /auth/confirm?token_hash=…&type=email|recovery: the link in our emails
 * (supabase/templates). GET only shows a button; the token is spent on the
 * POST, so link scanners that prefetch emails can't use it up, and it works
 * in a different browser from the one that asked for it.
 */
type LinkType = "email" | "recovery";

function linkType(value: string | null): LinkType | null {
  return value === "email" || value === "recovery" ? value : null;
}

function tokenHash(value: string | null): string | null {
  return value !== null && /^[A-Za-z0-9_-]{8,256}$/.test(value) ? value : null;
}

export function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const type = linkType(url.searchParams.get("type"));
  const hash = tokenHash(url.searchParams.get("token_hash"));
  return {
    csrf: context.security.csrfToken,
    link: type !== null && hash !== null ? { type, hash } : null,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const type = linkType(field(form, "type"));
  const hash = tokenHash(field(form, "token_hash"));
  if (type === null || hash === null) {
    return data({ failed: true, type: type ?? "email" }, { status: 400 });
  }
  const auth = authRequest(request, context.security);
  const { error } = await auth.supabase.auth.verifyOtp({
    token_hash: hash,
    type,
  });
  if (error !== null) {
    return data({ failed: true, type }, { status: 400, headers: auth.headers });
  }
  return redirect(
    type === "recovery" ? "/auth/reset-password" : "/account?confirmed=1",
    {
      headers: auth.headers,
    },
  );
}

function LinkFailed({ type }: { type: LinkType }) {
  return (
    <>
      <Notice tone="error">
        <span data-problem="link_invalid">{FAILURE_MESSAGES.link_invalid}</span>
      </Notice>
      <p>
        {type === "recovery" ? (
          <Link to="/auth/forgot-password">Send a new password reset link</Link>
        ) : (
          <Link to="/auth/check-email?resend=signup">
            Send a new confirmation link
          </Link>
        )}
      </p>
    </>
  );
}

export default function Confirm({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { link } = loaderData;
  if (actionData?.failed === true || link === null) {
    return (
      <AuthPage title="This link didn't work">
        <LinkFailed type={actionData?.type ?? link?.type ?? "email"} />
      </AuthPage>
    );
  }
  return (
    <AuthPage
      title={
        link.type === "recovery" ? "Reset your password" : "Confirm your email"
      }
    >
      <Form method="post">
        <CsrfField token={loaderData.csrf} />
        <input type="hidden" name="token_hash" value={link.hash} />
        <input type="hidden" name="type" value={link.type} />
        <button type="submit">
          {link.type === "recovery"
            ? "Continue to a new password"
            : "Confirm my email"}
        </button>
      </Form>
    </AuthPage>
  );
}
