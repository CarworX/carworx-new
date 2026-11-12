import { data } from "react-router";

import { accountTab, displayName } from "../account/forms";
import { throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import { Button, ButtonLink } from "../ui/Button";
import { TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import { TabBar } from "../ui/ScrollBar";
import type { Route } from "./+types/account.$tab";

const TABS = [
  { id: "profile", label: "Profile", href: "/account/profile" },
  { id: "security", label: "Security", href: "/account/security" },
  {
    id: "notifications",
    label: "Notifications",
    href: "/account/notifications",
  },
  { id: "privacy", label: "Privacy and data", href: "/account/privacy" },
  { id: "work", label: "Your work", href: "/account/work" },
] as const;

export const meta: Route.MetaFunction = () => [
  { title: "Profile and settings · CarworX" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const tab = accountTab(params.tab);
  if (tab === null) throwStatus(404, signedIn.headers);
  const label: unknown = signedIn.user.user_metadata["display_name"];
  return data(
    {
      tab,
      csrf: context.security.csrfToken,
      email: signedIn.user.email ?? "",
      name: typeof label === "string" ? label : "",
      aal: signedIn.aal,
      enrolled: signedIn.nextAal === "aal2",
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const tab = accountTab(params.tab);
  if (tab === null) throwStatus(404, signedIn.headers);
  const form = await request.formData();
  const intent = form.get("intent");
  const reply = (ok: boolean, message: string, status = 200) =>
    data({ ok, message }, { status, headers: signedIn.headers });
  if (tab === "profile" && intent === "profile") {
    const name = displayName(form.get("displayName"));
    if (name === null)
      return reply(false, "Use a name of up to 80 characters.", 400);
    const { error } = await signedIn.supabase.auth.updateUser({
      data: { display_name: name },
    });
    return error === null
      ? reply(true, "Your profile is saved.")
      : reply(false, "We couldn't save your profile. Please try again.", 503);
  }
  if (tab === "security" && intent === "sign-out-others") {
    const { error } = await signedIn.supabase.auth.signOut({ scope: "others" });
    return error === null
      ? reply(true, "Other sessions are signed out. This session stays open.")
      : reply(
          false,
          "We couldn't sign out your other sessions. Please try again.",
          503,
        );
  }
  return reply(false, "Choose an action on this settings page.", 400);
}

export default function Settings({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { tab, csrf } = loaderData;
  return (
    <PublicShell signedIn>
      <p className="cx-eyebrow">Your account</p>
      <h1 className="type-display-lg mt-1">Profile and settings</h1>
      <div className="mt-6">
        <TabBar label="Account settings" tabs={TABS} current={tab} />
      </div>
      {actionData ? (
        <div className="mt-6" role="status">
          <StatusNote
            tone={actionData.ok ? "ok" : "err"}
            title={actionData.message}
          />
        </div>
      ) : null}
      <section className="mt-8 grid max-w-[65ch] gap-5">
        {tab === "profile" ? (
          <>
            <h2 className="type-heading">Your profile</h2>
            <p>Signed in as {loaderData.email}.</p>
            <form method="post" className="grid gap-4">
              <CsrfField token={csrf} />
              <input type="hidden" name="intent" value="profile" />
              <TextField
                label="Display name"
                name="displayName"
                maxLength={80}
                defaultValue={loaderData.name}
                autoComplete="nickname"
              />
              <Button type="submit">Save profile</Button>
            </form>
          </>
        ) : tab === "security" ? (
          <>
            <h2 className="type-heading">Keep your account secure</h2>
            <p>
              {loaderData.enrolled
                ? "An authenticator is enrolled on your account."
                : "Add your own authenticator app for two-step sign-in."}
            </p>
            <p>
              {loaderData.aal === "aal2"
                ? "This session has passed authenticator verification."
                : "This session has not passed authenticator verification."}
            </p>
            <ButtonLink href="/auth/mfa">
              {loaderData.enrolled
                ? "Verify with your authenticator"
                : "Set up two-step sign-in"}
            </ButtonLink>
            <a className="cx-tlink" href="/auth/forgot-password">
              Reset your password
            </a>
            <form method="post">
              <CsrfField token={csrf} />
              <input type="hidden" name="intent" value="sign-out-others" />
              <Button type="submit">Sign out other devices</Button>
            </form>
          </>
        ) : tab === "notifications" ? (
          <>
            <h2 className="type-heading">Account and service messages</h2>
            <p>
              Security and service messages use your account email:{" "}
              {loaderData.email}.
            </p>
            <p>
              CarworX does not send marketing emails. Essential account security
              messages cannot be turned off here.
            </p>
          </>
        ) : tab === "privacy" ? (
          <>
            <h2 className="type-heading">Privacy and your data</h2>
            <p>
              For access, correction or deletion of your data, contact support.
              Requests are reviewed before any account data is removed.
            </p>
            <ButtonLink href="/support">Contact support</ButtonLink>
          </>
        ) : (
          <>
            <h2 className="type-heading">Your work and businesses</h2>
            <p>Manage your active memberships, business setup and enquiries.</p>
            <ButtonLink href="/provider">Open your workspace</ButtonLink>
          </>
        )}
      </section>
      <form method="post" action="/auth/sign-out" className="mt-10">
        <CsrfField token={csrf} />
        <Button type="submit">Sign out</Button>
      </form>
    </PublicShell>
  );
}
