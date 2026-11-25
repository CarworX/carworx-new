import { data } from "react-router";

import {
  ACCOUNT_NAV,
  accountTab,
  displayName,
  localMobile,
  mobileNumber,
} from "../account/forms";
import {
  exportCookie,
  exportLink,
  newExport,
  pendingExport,
  tokenHash,
} from "../account/export.server";
import { mediaBucket } from "../server/media/cover.server";
import { newAvatarKey } from "../server/media/avatar.server";
import { cleanImage, MAX_BYTES } from "../server/media/image";
import {
  PHOTO_LIMIT_TEXT,
  PHOTO_TOO_LARGE,
  uploadTooLarge,
} from "../server/media/limits";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import { Button, ButtonLink } from "../ui/Button";
import { TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import { TabBar } from "../ui/ScrollBar";
import { Icon } from "../ui/Icon";
import "../account/settings.css";
import "../account/profile.css";
import type { Route } from "./+types/account.$tab";

const TABS = ACCOUNT_NAV;

/**
 * PR 6: email change needs Auth to send its two confirmation links. Local
 * Auth does (supabase/templates/email_change.html); the hosted Auth email
 * hook doesn't yet, so it is off unless EMAIL_CHANGE_ENABLED is "1".
 */
function emailChangeEnabled(env: unknown): boolean {
  return (
    (env as Record<string, unknown> | null)?.["EMAIL_CHANGE_ENABLED"] === "1"
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_LABEL = { owner: "Owner", manager: "Manager", staff: "Staff" };

interface WorkMembership {
  organisation_id: string;
  role: keyof typeof ROLE_LABEL;
  organisations: { name: string };
}

interface ExportStatus {
  requested_at: string;
  expires_at: string;
  downloaded_at: string | null;
  next_allowed_at: string;
}

/** A date and time for display only, in South African time. */
function sastDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Johannesburg",
  }).format(date);
}

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
    .select("display_name, mobile")
    .eq("id", signedIn.user.id)
    .maybeSingle()
    .overrideTypes<
      { display_name: string; mobile: string | null },
      { merge: false }
    >();
  if (profile.error !== null) throwStatus(503, signedIn.headers);
  // PR 6: the profile photo, if any (only the person can read the row).
  let hasPhoto = false;
  if (tab === "profile") {
    const photo = await signedIn.supabase
      .from("profile_photos")
      .select("user_id")
      .eq("user_id", signedIn.user.id)
      .maybeSingle();
    if (photo.error !== null) throwStatus(503, signedIn.headers);
    hasPhoto = photo.data !== null;
  }
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
  let work: WorkMembership[] = [];
  if (tab === "work") {
    const memberships = await signedIn.supabase
      .from("memberships")
      .select("organisation_id, role, organisations!inner(name)")
      .eq("user_id", signedIn.user.id)
      .eq("status", "active")
      .order("created_at")
      .overrideTypes<WorkMembership[], { merge: false }>();
    if (memberships.error !== null) throwStatus(503, signedIn.headers);
    work = memberships.data;
  }
  let optionalEmail: boolean | null = false;
  if (tab === "notifications") {
    const preference = await signedIn.supabase
      .from("notification_preferences")
      .select("optional_email")
      .eq("user_id", signedIn.user.id)
      .maybeSingle()
      .overrideTypes<{ optional_email: boolean }, { merge: false }>();
    optionalEmail =
      preference.error === null
        ? (preference.data?.optional_email ?? false)
        : null;
  }
  let exportStatus: ExportStatus | null = null;
  let exportReady = false;
  if (tab === "privacy") {
    const status = await signedIn.supabase.rpc("data_export_status");
    const row: unknown = Array.isArray(status.data) ? status.data[0] : null;
    exportStatus =
      status.error === null && typeof row === "object" && row !== null
        ? (row as ExportStatus)
        : null;
    exportReady = pendingExport(request) !== null;
  }
  return data(
    {
      tab,
      optionalEmail,
      exportStatus,
      exportReady,
      // D-098: password accounts re-confirm with their password; others
      // with their authenticator (a session that passed the two-step check).
      hasPassword: (signedIn.user.identities ?? []).some(
        (i) => i.provider === "email",
      ),
      exportInvalid:
        new URL(request.url).searchParams.get("export") === "invalid",
      exportRetry: new URL(request.url).searchParams.get("export") === "retry",
      csrf: context.security.csrfToken,
      email: signedIn.user.email ?? "",
      name: profile.data?.display_name ?? "",
      mobile: localMobile(profile.data?.mobile),
      hasPhoto,
      // An email change waiting for its confirmation links (both addresses).
      newEmail: signedIn.user.new_email ?? null,
      emailChange: emailChangeEnabled(context.cloudflare.env),
      emailState: new URL(request.url).searchParams.get("email"),
      aal: signedIn.aal,
      enrolled: signedIn.nextAal === "aal2",
      factors,
      work,
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const tab = accountTab(params.tab);
  if (tab === null) throwStatus(404, signedIn.headers);
  // PR 6: a photo upload over the limit is refused before its body is read.
  if (
    tab === "profile" &&
    (request.headers.get("Content-Type") ?? "")
      .toLowerCase()
      .startsWith("multipart/form-data") &&
    uploadTooLarge(request)
  )
    return data(
      { ok: false, message: PHOTO_TOO_LARGE, link: null },
      { status: 413, headers: signedIn.headers },
    );
  const form = await request.formData();
  const intent = form.get("intent");
  const reply = (
    ok: boolean,
    message: string,
    status = 200,
    link: string | null = null,
  ) => data({ ok, message, link }, { status, headers: signedIn.headers });
  if (tab === "privacy" && intent === "close-account") {
    // D-098 (owner 2026-11-24): self-service, re-confirmed, 14-day grace.
    if (form.get("understand") !== "on")
      return reply(false, "Tick the box to confirm you understand.", 400);
    const hasPassword = (signedIn.user.identities ?? []).some(
      (i) => i.provider === "email",
    );
    if (hasPassword) {
      const password = form.get("password");
      const email = signedIn.user.email;
      if (
        typeof password !== "string" ||
        password.length === 0 ||
        password.length > 4096 ||
        typeof email !== "string"
      )
        return reply(false, "Enter your password to confirm.", 400);
      const check = await signedIn.supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (check.error !== null || check.data.user.id !== signedIn.user.id)
        return reply(false, "That password isn't right.", 400);
    } else {
      // No password: a fresh code from their authenticator. Verifying it
      // refreshes this session, which close_account checks (10 minutes).
      const code = form.get("code");
      if (typeof code !== "string" || !/^\d{6}$/.test(code))
        return reply(false, "Enter the 6-digit code from your app.", 400);
      const listed = await signedIn.supabase.auth.mfa.listFactors();
      const factor = listed.data?.totp[0];
      if (listed.error !== null || factor === undefined)
        return reply(
          false,
          "Add an authenticator app on the Security tab first, then try again.",
          403,
        );
      const verified = await signedIn.supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code,
      });
      if (verified.error !== null)
        return reply(false, "That code isn't right.", 400);
    }
    const closed = await signedIn.supabase.rpc("close_account");
    if (closed.error !== null) {
      const why = closed.error.message;
      return why === "owner_must_transfer"
        ? reply(
            false,
            "You're the only owner of a business. Hand it to someone on your team, or close the business, first.",
            409,
          )
        : why === "admin_account"
          ? reply(false, "Admin accounts are removed by another admin.", 403)
          : why === "already_closing"
            ? reply(false, "Your account is already closing.", 409)
            : why === "reconfirm_required"
              ? reply(false, "Please confirm it's you again.", 403)
              : reply(
                  false,
                  "We couldn't close your account. Please try again.",
                  503,
                );
    }
    const until = typeof closed.data === "string" ? closed.data : "";
    // Disabled at once: every session on every device ends now.
    await signedIn.supabase.auth.signOut({ scope: "global" });
    const on = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Africa/Johannesburg",
    }).format(new Date(until));
    return throwRedirect(
      `/account/closed?on=${encodeURIComponent(on)}`,
      signedIn.headers,
    );
  }
  if (tab === "privacy" && intent === "request-export") {
    // D-098 "Download my data": 1 per 24 h, kept 7 days, one-time link.
    const media = mediaBucket(context.cloudflare.env);
    if (media === null)
      return reply(false, "Data downloads aren't available right now.", 503);
    const { key, token } = newExport();
    const requested = await signedIn.supabase.rpc("request_data_export", {
      p_key: key,
      p_token_hash: await tokenHash(token),
    });
    if (requested.error !== null)
      return requested.error.message === "export_limit"
        ? reply(
            false,
            "You can ask for your data once every 24 hours. Use the link from your last request.",
            429,
          )
        : reply(false, "We couldn't prepare your data. Please try again.", 503);
    try {
      await media.put(
        key,
        new TextEncoder().encode(JSON.stringify(requested.data, null, 2)),
        { httpMetadata: { contentType: "application/json" } },
      );
    } catch {
      // Nothing stored: undo the request so the person can try again now.
      await signedIn.supabase.rpc("cancel_data_export", { p_key: key });
      return reply(
        false,
        "We couldn't prepare your data. Please try again.",
        503,
      );
    }
    signedIn.headers.append("Set-Cookie", exportCookie(token));
    return reply(
      true,
      "Your data is ready. Download it below.",
      200,
      new URL(exportLink(token), signedIn.config.appOrigin).toString(),
    );
  }
  if (tab === "profile" && intent === "upload-photo") {
    const photo = form.get("photo");
    if (!(photo instanceof File) || photo.size === 0)
      return reply(false, "Choose a photo to upload.", 400);
    if (photo.size > MAX_BYTES) return reply(false, PHOTO_TOO_LARGE, 413);
    // The real type comes from the bytes; every metadata block (GPS too) is
    // dropped, as for cover photos.
    const clean = cleanImage(new Uint8Array(await photo.arrayBuffer()));
    if (clean === null)
      return reply(
        false,
        "Use a JPEG, PNG or WebP photo (not animated), at most 6000 pixels on each side.",
        400,
      );
    const media = mediaBucket(context.cloudflare.env);
    if (media === null)
      return reply(false, "Photos can't be added right now.", 503);
    const key = newAvatarKey(clean.extension);
    try {
      await media.put(key, clean.bytes, {
        httpMetadata: { contentType: clean.type },
      });
    } catch {
      return reply(
        false,
        "We couldn't save your photo. Please try again.",
        503,
      );
    }
    const saved = await signedIn.supabase.rpc("set_profile_photo", {
      p_key: key,
      p_type: clean.type,
      p_bytes: clean.bytes.byteLength,
      p_width: clean.width,
      p_height: clean.height,
    });
    if (saved.error !== null) {
      // Not recorded, so not referenced: remove the stored file again.
      await media.delete(key).catch(() => undefined);
      return reply(
        false,
        "We couldn't save your photo. Please try again.",
        503,
      );
    }
    return reply(true, "Your photo is saved.");
  }
  if (tab === "profile" && intent === "remove-photo") {
    const removed = await signedIn.supabase.rpc("remove_profile_photo");
    if (removed.error !== null)
      return reply(
        false,
        "We couldn't remove your photo. Please try again.",
        503,
      );
    return reply(true, "Your photo is removed.");
  }
  if (tab === "profile" && intent === "change-email") {
    if (!emailChangeEnabled(context.cloudflare.env))
      return reply(false, "Changing your email isn't available yet.", 404);
    const raw = form.get("email");
    const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (
      email.length < 3 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
      return reply(false, "Enter a valid email address.", 400);
    if (email === (signedIn.user.email ?? "").toLowerCase())
      return reply(false, "That's already your email address.", 400);
    // Supabase Auth sends a link to both the current and the new address;
    // the change happens only once both are opened (double_confirm_changes).
    const changed = await signedIn.supabase.auth.updateUser({ email });
    if (changed.error !== null) {
      const code = changed.error.code ?? "";
      if (code === "email_exists")
        return reply(false, "That email address is already in use.", 409);
      if (code.startsWith("over_") || changed.error.status === 429)
        return reply(
          false,
          "We've sent a link recently. Please wait a minute and try again.",
          429,
        );
      return reply(
        false,
        "We couldn't start the change. Please try again.",
        503,
      );
    }
    return reply(
      true,
      "Check both inboxes. We've sent a link to your current and your new address. Your email changes once you open both.",
    );
  }
  if (tab === "profile" && intent === "profile") {
    const name = displayName(form.get("displayName"));
    if (name === null)
      return reply(false, "Use a name of up to 80 characters.", 400);
    // No mobile field at all leaves the saved number as it is; an empty one
    // clears it.
    const sent = form.has("mobile");
    const mobile = sent ? mobileNumber(form.get("mobile")) : "";
    if (mobile === null)
      return reply(
        false,
        "Use a South African mobile number, for example 072 000 0000.",
        400,
      );
    // Update only the granted display_name column; upsert would also require
    // UPDATE(id), which is intentionally not granted to authenticated callers.
    const update = () =>
      signedIn.supabase
        .from("profiles")
        .update(
          sent
            ? { display_name: name, mobile: mobile === "" ? null : mobile }
            : { display_name: name },
        )
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
        ...(sent ? { mobile: mobile === "" ? null : mobile } : {}),
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
  if (tab === "notifications" && intent === "notifications") {
    const values = form.getAll("optionalEmail");
    if (values.length > 1 || (values.length === 1 && values[0] !== "on"))
      return reply(false, "Choose a valid email preference.", 400);

    const { error } = await signedIn.supabase.rpc(
      "save_notification_preferences",
      { p_optional_email: values.length === 1 },
    );
    return error === null
      ? reply(true, "Your notification settings are saved.")
      : reply(false, "We couldn't save your settings. Please try again.", 503);
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
    // A security change ends every other session, whether or not the refresh
    // worked; this one stays open.
    const others = await signedIn.supabase.auth.signOut({ scope: "others" });
    const steps = [
      others.error === null
        ? "your other devices are signed out"
        : 'use "Sign out other devices" to end your other sessions',
      ...(refreshed.error === null
        ? []
        : ["sign out and back in to set up a new one"]),
    ];
    return reply(
      true,
      `The authenticator is removed. ${steps.join(", and ").replace(/^./, (c) => c.toUpperCase())}.`,
    );
  }
  if (tab === "work" && intent === "leave") {
    const org = form.get("org");
    if (typeof org !== "string" || !UUID.test(org))
      return reply(false, "Choose a business to leave.", 400);
    // The database checks membership and refuses the last owner.
    const left = await signedIn.supabase.rpc("leave_team", { p_org: org });
    if (left.error === null)
      return reply(true, "You left the business. Its records stay with it.");
    if (left.error.message === "last_owner")
      return reply(
        false,
        "A business needs at least one owner. Transfer ownership to someone first.",
        400,
      );
    if (left.error.code === "42501")
      return reply(false, "You aren't a member of that business.", 403);
    return reply(false, "We couldn't do that. Please try again.", 503);
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
      <div className="cx-account-settings">
        <header className="cx-account-who">
          <span className="cx-account-avatar">
            <Icon name="user" size="lg" />
          </span>
          <div>
            <p className="cx-eyebrow">Your account</p>
            <h1>Profile and settings</h1>
          </div>
        </header>
        <TabBar label="Account settings" tabs={TABS} current={tab} />
        {actionData ? (
          <div className="mt-6" role="status">
            <StatusNote
              tone={actionData.ok ? "ok" : "err"}
              title={actionData.message}
            />
          </div>
        ) : null}
        <section className="cx-account-box">
          {tab === "profile" ? (
            <>
              <h2 className="type-heading">Your details</h2>
              {loaderData.emailState === "confirmed" ? (
                <StatusNote tone="ok" title="Your email address is changed." />
              ) : loaderData.emailState === "half" ? (
                <StatusNote title="One link done.">
                  Now open the link we sent to your other address.
                </StatusNote>
              ) : null}
              <TextField
                label="Full name"
                name="displayName"
                form="cx-profile"
                required
                minLength={1}
                maxLength={80}
                defaultValue={loaderData.name}
                autoComplete="name"
              />
              <div className="cx-account-line" data-email>
                <div>
                  <strong>Email</strong>
                  <p>{loaderData.email}</p>
                </div>
                <span className="cx-account-label">Verified</span>
              </div>
              {loaderData.newEmail !== null ? (
                <p className="cx-account-note" data-pending-email>
                  {`Waiting for you to confirm ${loaderData.newEmail}. Open the links we sent to both addresses.`}
                </p>
              ) : null}
              {loaderData.emailChange ? (
                <details className="cx-account-change">
                  <summary>Change email</summary>
                  <form method="post" className="grid gap-3">
                    <CsrfField token={csrf} />
                    <input type="hidden" name="intent" value="change-email" />
                    <TextField
                      label="New email address"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      hint="We'll send a link to your current and your new address. Your email changes once you open both."
                    />
                    <div>
                      <Button type="submit" variant="outline" size="sm">
                        Send the links
                      </Button>
                    </div>
                  </form>
                </details>
              ) : null}
              <TextField
                label="Mobile number (optional)"
                name="mobile"
                form="cx-profile"
                inputMode="tel"
                autoComplete="tel"
                maxLength={32}
                placeholder="For example, 072 000 0000"
                defaultValue={loaderData.mobile}
                hint="Private. Only you can see it."
              />
              <div className="cx-account-line" data-photo>
                <div>
                  <strong>Profile photo</strong>
                  <p>{`Optional. ${PHOTO_LIMIT_TEXT}.`}</p>
                </div>
                {loaderData.hasPhoto ? (
                  <img
                    className="cx-account-photo"
                    src="/account/photo"
                    alt="Your profile photo"
                    width={56}
                    height={56}
                  />
                ) : null}
              </div>
              <form
                method="post"
                encType="multipart/form-data"
                className="cx-account-photo-form"
              >
                <CsrfField token={csrf} />
                <input type="hidden" name="intent" value="upload-photo" />
                <label className="grid gap-1">
                  <span className="type-label">
                    {loaderData.hasPhoto ? "Replace the photo" : "Add a photo"}
                  </span>
                  <input
                    type="file"
                    name="photo"
                    accept="image/jpeg,image/png,image/webp"
                    required
                  />
                </label>
                <div>
                  <Button type="submit" variant="outline" size="sm">
                    {loaderData.hasPhoto ? "Replace photo" : "Add photo"}
                  </Button>
                </div>
              </form>
              {loaderData.hasPhoto ? (
                <form method="post">
                  <CsrfField token={csrf} />
                  <input type="hidden" name="intent" value="remove-photo" />
                  <Button type="submit" variant="outline" size="sm">
                    Remove photo
                  </Button>
                </form>
              ) : null}
              <form method="post" id="cx-profile" className="cx-account-acts">
                <CsrfField token={csrf} />
                <input type="hidden" name="intent" value="profile" />
                <Button variant="primary" type="submit">
                  Save
                </Button>
              </form>
              <p className="cx-account-private">
                <Icon name="lock" size="sm" />
                <span>We never ask for your ID number or date of birth.</span>
              </p>
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
                Account security messages, receipts and booking-change messages
                are always enabled.
              </p>
              {loaderData.optionalEmail === null ? (
                <>
                  <StatusNote
                    tone="err"
                    title="We couldn't load your notification settings."
                  />
                  <ButtonLink href="/account/notifications">
                    Try again
                  </ButtonLink>
                </>
              ) : (
                <form method="post" className="grid gap-4">
                  <CsrfField token={csrf} />
                  <input type="hidden" name="intent" value="notifications" />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="optionalEmail"
                      value="on"
                      defaultChecked={loaderData.optionalEmail}
                      aria-describedby="optional-email-description"
                    />
                    Receive optional emails
                  </label>
                  <p id="optional-email-description">
                    This preference applies as optional emails become available.
                  </p>
                  <Button type="submit">Save settings</Button>
                </form>
              )}
            </>
          ) : tab === "privacy" ? (
            <>
              <h2 className="type-heading" id="your-data">
                Your data
              </h2>
              <div className="cx-account-line" data-export>
                <div>
                  <strong>Download my data</strong>
                  <p>A copy of what CarworX holds about you</p>
                  <p className="type-caption">
                    {loaderData.exportStatus
                      ? `Last asked ${sastDateTime(loaderData.exportStatus.requested_at)}${loaderData.exportStatus.downloaded_at ? ", downloaded" : ""}. `
                      : ""}
                    Once every 24 hours; the link works once, for 7 days.
                  </p>
                </div>
                <form method="post">
                  <CsrfField token={csrf} />
                  <input type="hidden" name="intent" value="request-export" />
                  <button type="submit" className="cx-tlink">
                    Request
                  </button>
                </form>
              </div>
              {loaderData.exportRetry ? (
                <StatusNote
                  tone="err"
                  title="We couldn't fetch your file just now."
                >
                  Your link still works. Try the download again.
                </StatusNote>
              ) : null}
              {loaderData.exportInvalid ? (
                <StatusNote
                  tone="err"
                  title="That download link can't be used."
                >
                  It may have been used already, have expired, or belong to
                  another account. Ask for your data again after 24 hours.
                </StatusNote>
              ) : null}
              {actionData?.link ? (
                <div className="grid gap-2" data-export-link>
                  <label className="type-label" htmlFor="export-link">
                    Your one-time link (keep it private)
                  </label>
                  <input
                    id="export-link"
                    className="cx-input"
                    readOnly
                    value={actionData.link}
                  />
                </div>
              ) : null}
              {loaderData.exportReady || actionData?.link ? (
                <form method="post" action="/account/privacy/download">
                  <CsrfField token={csrf} />
                  <Button type="submit">Download my data file</Button>
                </form>
              ) : null}
              <h3 className="type-title cx-account-sub" id="delete-account">
                Delete my account
              </h3>
              <ul className="cx-account-facts">
                <li>
                  Your account is closed at once and you're signed out on every
                  device. You leave any team you're part of.
                </li>
                <li>
                  We keep your data for 14 days, then delete it and email you
                  that it's done.
                </li>
                <li>
                  Changed your mind? Sign in within the 14 days and confirm that
                  you want to keep your account.
                </li>
                <li>
                  Messages you sent to businesses stay with them without your
                  name or email. Records the law requires are kept without your
                  name.
                </li>
              </ul>
              <form method="post" className="grid gap-3" data-close-account>
                <CsrfField token={csrf} />
                <input type="hidden" name="intent" value="close-account" />
                {loaderData.hasPassword ? (
                  <TextField
                    label="Your password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                ) : (
                  <TextField
                    label="Code from your authenticator app"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                )}
                <label className="flex items-start gap-2">
                  <input type="checkbox" name="understand" required />
                  <span>
                    I understand my account will be deleted after 14 days.
                  </span>
                </label>
                <div>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="danger"
                  >
                    Delete my account
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h2 className="type-heading">Your work and businesses</h2>
              {loaderData.work.length === 0 ? (
                <p>You aren't a member of any business yet.</p>
              ) : (
                <ul className="cx-account-work">
                  {loaderData.work.map((membership) => (
                    <li key={membership.organisation_id}>
                      <div>
                        <strong>{membership.organisations.name}</strong>
                        <p>{ROLE_LABEL[membership.role]}</p>
                      </div>
                      <ButtonLink
                        variant="outline"
                        size="sm"
                        href={`/provider#business-${membership.organisation_id}`}
                        aria-label={`Open ${membership.organisations.name} workspace`}
                      >
                        Open workspace
                      </ButtonLink>
                    </li>
                  ))}
                </ul>
              )}
              {loaderData.work.map((membership) => (
                <div
                  key={membership.organisation_id}
                  className="cx-account-leave"
                  data-leave={membership.organisation_id}
                >
                  <h3 className="type-title">Leave this team</h3>
                  <p>
                    The people who run {membership.organisations.name} will see
                    that you left. Its records stay with the business.
                  </p>
                  <form method="post">
                    <CsrfField token={csrf} />
                    <input type="hidden" name="intent" value="leave" />
                    <input
                      type="hidden"
                      name="org"
                      value={membership.organisation_id}
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="danger"
                    >
                      {`Leave ${membership.organisations.name}`}
                    </Button>
                  </form>
                </div>
              ))}
            </>
          )}
        </section>
        <form method="post" action="/auth/sign-out">
          <CsrfField token={csrf} />
          <Button type="submit">Sign out</Button>
        </form>
      </div>
    </PublicShell>
  );
}
