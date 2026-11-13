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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A date for display only, in South African time. */
function addedOn(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  }).format(date);
}

export const meta: Route.MetaFunction = () => [
  { title: "Profile and settings · CarworX" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const tab = accountTab(params.tab);
  if (tab === null) throwStatus(404, signedIn.headers);
  const profile = await signedIn.supabase
    .from("profiles")
    .select("display_name")
    .eq("id", signedIn.user.id)
    .maybeSingle()
    .overrideTypes<{ display_name: string }, { merge: false }>();
  if (profile.error !== null) throwStatus(503, signedIn.headers);
  let factors: { id: string; name: string; addedOn: string }[] = [];
  if (tab === "security") {
    // listFactors().totp holds verified TOTP factors only.
    const listed = await signedIn.supabase.auth.mfa.listFactors();
    if (listed.error !== null) throwStatus(503, signedIn.headers);
    factors = listed.data.totp.map((f) => ({
      id: f.id,
      name: f.friendly_name ?? "Authenticator app",
      addedOn: addedOn(f.created_at),
    }));
  }
  return data(
    {
      tab,
      csrf: context.security.csrfToken,
      email: signedIn.user.email ?? "",
      name: profile.data?.display_name ?? "",
      aal: signedIn.aal,
      enrolled: signedIn.nextAal === "aal2",
      factors,
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
    // Update only the granted display_name column; upsert would also require
    // UPDATE(id), which is intentionally not granted to authenticated callers.
    const update = () =>
      signedIn.supabase
        .from("profiles")
        .update({ display_name: name })
        .eq("id", signedIn.user.id)
        .select("id")
        .maybeSingle()
        .overrideTypes<{ id: string }, { merge: false }>();
    const saved = await update();
    if (saved.error !== null)
      return reply(
        false,
        "We couldn't save your profile. Please try again.",
        503,
      );
    if (saved.data === null) {
      const inserted = await signedIn.supabase.from("profiles").insert({
        id: signedIn.user.id,
        display_name: name,
      });
      if (inserted.error !== null) {
        // Another session may have created this same person's profile first.
        if (inserted.error.code !== "23505")
          return reply(
            false,
            "We couldn't save your profile. Please try again.",
            503,
          );
        const retried = await update();
        if (retried.error !== null || retried.data === null)
          return reply(
            false,
            "We couldn't save your profile. Please try again.",
            503,
          );
      }
    }
    return reply(true, "Your profile is saved.");
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
  if (tab === "security" && intent === "remove-factor") {
    const factorId = form.get("factorId");
    if (typeof factorId !== "string" || !UUID.test(factorId))
      return reply(false, "Choose an authenticator to remove.", 400);
    // Removing a verified factor needs a session that has just proved it
    // (aal2). Supabase enforces this too; checking first gives a clear message.
    if (signedIn.aal !== "aal2")
      return reply(
        false,
        "Verify with your authenticator first, then remove it.",
        403,
      );
    const listed = await signedIn.supabase.auth.mfa.listFactors();
    if (listed.error !== null)
      return reply(false, "We couldn't check your authenticators.", 503);
    if (!listed.data.all.some((f) => f.id === factorId))
      return reply(false, "That authenticator isn't on your account.", 404);
    const removed = await signedIn.supabase.auth.mfa.unenroll({ factorId });
    if (removed.error !== null)
      return reply(
        false,
        "We couldn't remove that authenticator. Please try again.",
        503,
      );
    // unenroll does not refresh the session, so this cookie's token would
    // still say aal2. Refresh now so the page and /auth/mfa see the new level
    // (Set-Cookie goes out in signedIn.headers).
    const refreshed = await signedIn.supabase.auth.refreshSession();
    if (refreshed.error !== null)
      return reply(
        true,
        "The authenticator is removed. Sign out and back in to set up a new one.",
      );
    // A security change ends every other session; this one stays open.
    const others = await signedIn.supabase.auth.signOut({ scope: "others" });
    return others.error === null
      ? reply(
          true,
          "The authenticator is removed and your other devices are signed out.",
        )
      : reply(
          true,
          'The authenticator is removed. Use "Sign out other devices" to end your other sessions.',
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
                required
                minLength={1}
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
            <h3 className="type-title">Two-step sign-in</h3>
            {loaderData.factors.length === 0 ? (
              <p>
                Add an authenticator app, such as Google Authenticator or
                Microsoft Authenticator. You'll enter a 6-digit code from it
                when you sign in.
              </p>
            ) : (
              <ul className="grid gap-3" aria-label="Your authenticator apps">
                {loaderData.factors.map((factor) => (
                  <li
                    key={factor.id}
                    className="cx-surface flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
                  >
                    <span>
                      <strong>{factor.name}</strong>
                      {factor.addedOn !== "" ? (
                        <span className="type-body-sm block">
                          Added {factor.addedOn}
                        </span>
                      ) : null}
                    </span>
                    {loaderData.aal === "aal2" ? (
                      <form method="post">
                        <CsrfField token={csrf} />
                        <input
                          type="hidden"
                          name="intent"
                          value="remove-factor"
                        />
                        <input
                          type="hidden"
                          name="factorId"
                          value={factor.id}
                        />
                        <Button type="submit">Remove</Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p data-aal={loaderData.aal}>
              {loaderData.aal === "aal2"
                ? "This session has passed the authenticator check."
                : loaderData.enrolled
                  ? "This session hasn't passed the authenticator check yet. Verify to make changes."
                  : "Two-step sign-in is off."}
            </p>
            {loaderData.aal !== "aal2" ? (
              <ButtonLink href="/auth/mfa?returnTo=%2Faccount%2Fsecurity">
                {loaderData.enrolled
                  ? "Verify with your authenticator"
                  : "Set up two-step sign-in"}
              </ButtonLink>
            ) : null}
            <h3 className="type-title">Password and devices</h3>
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
