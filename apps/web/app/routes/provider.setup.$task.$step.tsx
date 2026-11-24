import { readTeamChanges, type TeamChange } from "../team/changes";
import { UUID } from "../server/providers/forms";
import {
  coverUrl,
  mediaBucket,
  newCoverKey,
} from "../server/media/cover.server";
import { cleanImage, MAX_BYTES } from "../server/media/image";
import { data } from "react-router";

import { field, parseEmail } from "../auth/forms";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  assignment,
  DAYS,
  INVITE_TOKEN,
  initials,
  inviteRole,
  memberRole,
  ROLE_LABEL,
  setupHref,
  staffProfile,
  TEAM_PROBLEMS,
  teamProblem,
  visibility,
  type TeamProblem,
} from "../team/forms";
import {
  loadTeam,
  privateHeaders,
  teamMembers,
  teamServices,
  type StaffProfile,
  type TeamInvite,
  type TeamMemberRow,
} from "../team/server";
import { Button, ButtonLink } from "../ui/Button";
import { StatusLabel } from "../ui/Chip";
import { ChoiceTiles, PickChips } from "../ui/Choice";
import { TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/provider.setup.$task.$step";
import { PublicShell } from "../ui/public/PublicShell";
import "../team/setup.css";

const STEPS: Record<string, readonly string[]> = {
  team: ["start", "role", "share"],
  assign: ["start"],
  contact: ["start"],
  profile: ["start"],
  cover: ["start"],
  history: ["start"],
};
const TITLES: Record<string, string> = {
  team: "Your team",
  assign: "Who gets the booking",
  contact: "What staff can see",
  profile: "Your services and days",
  cover: "Cover photo",
  history: "Team changes",
};

/** "invite expires in 3 days", counted in whole days (an invite lasts 7). */
function expiresIn(iso: string) {
  const days = Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
  if (!Number.isFinite(days) || days <= 1) return "invite expires today";
  return `invite expires in ${String(days)} days`;
}

interface CoverListing {
  public_id: string;
  display_name: string;
  status: string;
  cover: string | null;
}

export const meta: Route.MetaFunction = () => [
  { title: "Finish setup · CarworX" },
];

async function setup(
  request: Request,
  params: { task: string; step: string },
  context: Route.LoaderArgs["context"],
) {
  const signedIn = await requireSignedIn(request, context.security);
  privateHeaders(signedIn.headers);
  if (!STEPS[params.task]?.includes(params.step))
    throwStatus(404, signedIn.headers);
  const team = await loadTeam(
    signedIn,
    new URL(request.url).searchParams.get("org"),
  );
  if (
    (team.membership.role === "staff" && params.task !== "profile") ||
    (params.task === "contact" && team.membership.role !== "owner")
  )
    throwStatus(404, signedIn.headers);
  return { signedIn, ...team };
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const { signedIn, organisation, membership } = await setup(
    request,
    params,
    context,
  );
  const services = await teamServices(signedIn, organisation.id);
  const profile = await signedIn.supabase
    .from("staff_profiles")
    .select("membership_id, first_name, service_slugs, days")
    .eq("membership_id", membership.id)
    .maybeSingle()
    .overrideTypes<StaffProfile | null, { merge: false }>();
  if (profile.error !== null) throwStatus(503, signedIn.headers);
  let members: TeamMemberRow[] = [];
  let invites: TeamInvite[] = [];
  if (params.task === "team") {
    const [people, pending] = await Promise.all([
      teamMembers(signedIn, organisation.id),
      signedIn.supabase
        .from("invites")
        .select("id, role, email, expires_at, used_at")
        .eq("organisation_id", organisation.id)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(50)
        .overrideTypes<TeamInvite[], { merge: false }>(),
    ]);
    if (pending.error !== null) throwStatus(503, signedIn.headers);
    members = people;
    invites = pending.data;
  }
  let changes: TeamChange[] | null = [];
  let covers: CoverListing[] = [];
  if (params.task === "cover") {
    const [listings, current] = await Promise.all([
      signedIn.supabase
        .from("listings")
        .select("public_id, display_name, status")
        .eq("organisation_id", organisation.id)
        .order("created_at")
        .limit(20)
        .overrideTypes<
          { public_id: string; display_name: string; status: string }[],
          { merge: false }
        >(),
      signedIn.supabase
        .from("listing_covers")
        .select("listing_public_id, object_key")
        .eq("organisation_id", organisation.id)
        .overrideTypes<
          { listing_public_id: string; object_key: string }[],
          { merge: false }
        >(),
    ]);
    if (listings.error !== null || current.error !== null)
      throwStatus(503, signedIn.headers);
    covers = listings.data.map((l) => ({
      ...l,
      cover: coverUrl(
        current.data.find((c) => c.listing_public_id === l.public_id)
          ?.object_key,
      ),
    }));
  }
  if (params.task === "history") {
    // Narrow projection only. audit_log itself stays admin-only under RLS.
    const result: { data: unknown; error: unknown } =
      await signedIn.supabase.rpc("team_changes", { p_org: organisation.id });
    changes = result.error === null ? readTeamChanges(result.data) : null;
  }
  return data(
    {
      csrf: context.security.csrfToken,
      organisation,
      membership,
      services,
      profile: profile.data,
      task: params.task,
      step: params.step,
      members,
      invites,
      changes,
      covers,
      inviteRole: inviteRole(
        new URL(request.url).searchParams.get("role") ?? "staff",
        membership.role,
      ),
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const { signedIn, organisation, membership } = await setup(
    request,
    params,
    context,
  );
  const form = await request.formData();
  const intent = field(form, "intent");
  const fail = (problem: TeamProblem) =>
    data(
      { problem, inviteUrl: null },
      {
        headers: signedIn.headers,
        status: problem === "unavailable" ? 503 : 400,
      },
    );
  if (params.task === "cover") {
    // Owners and managers only (staff get 404 in setup()); the database
    // checks the role and the listing's business again.
    const listing = field(form, "listing");
    if (!UUID.test(listing)) return fail("invalid_input");
    const own = await signedIn.supabase
      .from("listings")
      .select("public_id")
      .eq("public_id", listing)
      .eq("organisation_id", organisation.id)
      .maybeSingle();
    if (own.error !== null) return fail("unavailable");
    if (own.data === null) return fail("not_allowed");
    if (intent === "remove-cover") {
      const removed = await signedIn.supabase.rpc("remove_listing_cover", {
        p_listing: listing,
      });
      if (removed.error !== null) return fail(teamProblem(removed.error));
      return throwRedirect(
        setupHref(organisation.id, "cover"),
        signedIn.headers,
      );
    }
    if (intent !== "upload-cover") return fail("invalid_input");
    const photo = form.get("photo");
    if (!(photo instanceof File) || photo.size === 0)
      return fail("photo_invalid");
    if (photo.size > MAX_BYTES) return fail("photo_too_large");
    // The real type comes from the bytes; every metadata block is dropped.
    const clean = cleanImage(new Uint8Array(await photo.arrayBuffer()));
    if (clean === null) return fail("photo_invalid");
    const media = mediaBucket(context.cloudflare.env);
    if (media === null) return fail("unavailable");
    const key = newCoverKey(clean.extension);
    try {
      await media.put(key, clean.bytes, {
        httpMetadata: { contentType: clean.type },
      });
    } catch {
      return fail("unavailable");
    }
    const saved = await signedIn.supabase.rpc("set_listing_cover", {
      p_listing: listing,
      p_key: key,
      p_type: clean.type,
      p_bytes: clean.bytes.length,
      p_width: clean.width,
      p_height: clean.height,
    });
    if (saved.error !== null) {
      // Nothing points at the file: remove it now rather than leave an orphan.
      await media.delete(key).catch(() => undefined);
      return fail(teamProblem(saved.error));
    }
    return throwRedirect(setupHref(organisation.id, "cover"), signedIn.headers);
  }
  if (params.task === "team" && intent === "set-role") {
    // Owners only; the database checks it again, plus the last-owner rule.
    const target = field(form, "membership");
    const role = memberRole(field(form, "role"));
    if (!UUID.test(target) || role === null) return fail("invalid_input");
    if (membership.role !== "owner") return fail("not_allowed");
    const result = await signedIn.supabase.rpc("set_member_role", {
      p_membership: target,
      p_role: role,
    });
    if (result.error !== null) return fail(teamProblem(result.error));
    return throwRedirect(setupHref(organisation.id, "team"), signedIn.headers);
  }
  if (params.task === "team" && intent === "cancel-invite") {
    const invite = field(form, "invite");
    if (!UUID.test(invite)) return fail("invalid_input");
    const result = await signedIn.supabase.rpc("revoke_invite", {
      p_invite: invite,
    });
    if (result.error !== null) return fail(teamProblem(result.error));
    return throwRedirect(setupHref(organisation.id, "team"), signedIn.headers);
  }
  if (params.task === "team") {
    const role = inviteRole(field(form, "role"), membership.role);
    if (role === null) return fail("not_allowed");
    if (intent === "choose-role")
      return throwRedirect(
        `${setupHref(organisation.id, "team", "share")}&role=${role}`,
        signedIn.headers,
      );
    if (intent !== "create-link") return fail("invalid_input");
    const email = parseEmail(form);
    if (field(form, "email").trim() && email === null)
      return fail("invalid_input");
    const result = await signedIn.supabase.rpc("create_invite", {
      p_org: organisation.id,
      p_role: role,
      p_email: email,
    });
    if (result.error !== null) return fail(teamProblem(result.error));
    if (typeof result.data !== "string" || !INVITE_TOKEN.test(result.data))
      return fail("unavailable");
    // The raw secret is returned once to this private response and never logged/stored.
    const inviteUrl = new URL(
      `/join/${result.data}`,
      signedIn.config.appOrigin,
    ).toString();
    return data({ problem: null, inviteUrl }, { headers: signedIn.headers });
  }
  if (params.task === "assign" || params.task === "contact") {
    const settings =
      params.task === "assign" ? assignment(form) : visibility(form);
    if (settings === null || intent !== "save") return fail("invalid_input");
    const result = await signedIn.supabase.rpc("set_team_settings", {
      p_org: organisation.id,
      p: settings,
    });
    if (result.error !== null) return fail(teamProblem(result.error));
  } else if (params.task === "profile") {
    const services = await teamServices(signedIn, organisation.id);
    const profile = staffProfile(
      form,
      organisation.assign_mode,
      services.map((s) => s.slug),
    );
    if (profile === null || intent !== "save") return fail("invalid_input");
    const result = await signedIn.supabase.rpc("set_staff_profile", {
      p_membership: membership.id,
      p: profile,
    });
    if (result.error !== null) return fail(teamProblem(result.error));
  } else return fail("invalid_input");
  return throwRedirect("/provider?done=1", signedIn.headers);
}

export default function TeamSetup({
  loaderData: d,
  actionData,
}: Route.ComponentProps) {
  const org = d.organisation;
  return (
    <PublicShell signedIn>
      <div className="cx-setup-flow">
        <a className="cx-tlink" href={`/provider#business-${org.id}`}>
          All setup tasks
        </a>
        <p className="type-label text-quiet">{org.name}</p>
        <h1 className="type-display-lg">{TITLES[d.task]}</h1>
        <div className="cx-setup-card">
          {actionData?.problem ? (
            <StatusNote tone="err" title="That didn't work.">
              {TEAM_PROBLEMS[actionData.problem]}
            </StatusNote>
          ) : null}
          {d.task === "team" && d.step === "start" ? (
            <>
              <p className="type-body">
                Everyone uses their own account. Owners and managers can invite
                staff; only owners can invite managers.
              </p>
              <ul className="cx-team-list">
                {d.members.map((member) => {
                  const self = member.user_id === d.membership.user_id;
                  const name = member.display_name ?? "Name not set yet";
                  return (
                    <li key={member.id} data-member={member.id}>
                      <span className="cx-team-av" aria-hidden="true">
                        {initials(member.display_name)}
                      </span>
                      <span className="cx-team-who">
                        <b>{self ? `${name} (you)` : name}</b>
                        <small>{ROLE_LABEL[member.role]}</small>
                      </span>
                      <StatusLabel>Active</StatusLabel>
                      {d.membership.role === "owner" &&
                      !self &&
                      member.role !== "owner" ? (
                        <form method="post" className="cx-team-role">
                          <CsrfField token={d.csrf} />
                          <input type="hidden" name="intent" value="set-role" />
                          <input
                            type="hidden"
                            name="membership"
                            value={member.id}
                          />
                          <input
                            type="hidden"
                            name="role"
                            value={
                              member.role === "staff" ? "manager" : "staff"
                            }
                          />
                          <button
                            type="submit"
                            className="cx-tlink"
                            aria-label={
                              member.role === "staff"
                                ? `Make ${name} a manager`
                                : `Make ${name} staff`
                            }
                          >
                            {member.role === "staff"
                              ? "Make manager"
                              : "Make staff"}
                          </button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {d.members.length === 100 ? (
                <p className="type-caption">
                  Showing the first 100 active members.
                </p>
              ) : null}
              {d.invites.length > 0 ? (
                <section>
                  <h2 className="type-title">Pending invites</h2>
                  <ul className="cx-team-list mt-3">
                    {d.invites.map((invite) => (
                      <li key={invite.id} data-invite={invite.id}>
                        <span className="cx-team-av pending" aria-hidden="true">
                          …
                        </span>
                        <span className="cx-team-who">
                          <b>{invite.email ?? "One-time link"}</b>
                          <small>
                            {`${ROLE_LABEL[invite.role]} · ${expiresIn(invite.expires_at)}`}
                          </small>
                        </span>
                        <StatusLabel tone="warn">Invited</StatusLabel>
                        {d.membership.role === "owner" ||
                        invite.role === "staff" ? (
                          <form method="post" className="cx-team-role">
                            <CsrfField token={d.csrf} />
                            <input
                              type="hidden"
                              name="intent"
                              value="cancel-invite"
                            />
                            <input
                              type="hidden"
                              name="invite"
                              value={invite.id}
                            />
                            <button
                              type="submit"
                              className="cx-tlink cx-team-danger"
                            >
                              Cancel invite
                            </button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <div>
                <ButtonLink href={setupHref(org.id, "team", "role")} arrow>
                  Invite someone
                </ButtonLink>
              </div>
            </>
          ) : null}
          {d.task === "team" && d.step === "role" ? (
            <form method="post" className="grid gap-5">
              <CsrfField token={d.csrf} />
              <input type="hidden" name="intent" value="choose-role" />
              <ChoiceTiles
                name="role"
                legend="What will they do?"
                defaultValue="staff"
                required
                options={[
                  {
                    value: "staff",
                    title: "Staff",
                    description: "See their work and assigned booking details.",
                  },
                  ...(d.membership.role === "owner"
                    ? [
                        {
                          value: "manager",
                          title: "Manager",
                          description:
                            "Help manage the business and invite staff.",
                        },
                      ]
                    : []),
                ]}
              />
              <div>
                <Button type="submit" variant="primary">
                  Continue
                </Button>
              </div>
            </form>
          ) : null}
          {d.task === "team" && d.step === "share" ? (
            actionData?.inviteUrl ? (
              <>
                <StatusNote tone="ok" title="Link ready">
                  Share it privately with the person you are inviting. It works
                  once, expires in seven days, and is not shown again after
                  leaving this page.
                </StatusNote>
                <TextField
                  label="One-time invite link"
                  readOnly
                  value={actionData.inviteUrl}
                  onFocus={(event) => {
                    event.currentTarget.select();
                  }}
                />
                <div>
                  <ButtonLink href={setupHref(org.id, "team")} arrow>
                    Back to your team
                  </ButtonLink>
                </div>
              </>
            ) : (
              <form method="post" className="grid gap-5">
                <CsrfField token={d.csrf} />
                <input type="hidden" name="intent" value="create-link" />
                <input type="hidden" name="role" value={d.inviteRole ?? ""} />
                <StatusNote title="Share a one-time link">
                  Invite a {d.inviteRole ?? "team member"} using a private link.
                  Email delivery is not available here yet; no email will be
                  sent.
                </StatusNote>
                <TextField
                  label="Restrict to an email address (optional)"
                  name="email"
                  type="email"
                  autoComplete="off"
                  maxLength={254}
                  hint="Only someone signed in with this verified address can accept the link."
                />
                <div>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={d.inviteRole === null}
                  >
                    Create invite link
                  </Button>
                </div>
              </form>
            )
          ) : null}
          {d.task === "assign" ? (
            <form method="post" className="grid gap-5">
              <CsrfField token={d.csrf} />
              <input type="hidden" name="intent" value="save" />
              <ChoiceTiles
                legend="Who picks the staff member?"
                name="assignMode"
                defaultValue={org.assign_mode}
                required
                options={[
                  {
                    value: "customer",
                    title: "Customers pick",
                    description: "Show available people by first name.",
                  },
                  {
                    value: "business",
                    title: "We assign",
                    description: "The owner or a manager chooses the person.",
                  },
                ]}
              />
              <label className="type-body">
                <input
                  type="checkbox"
                  name="offerAnyone"
                  defaultChecked={org.offer_anyone}
                />{" "}
                Offer “Anyone available” when customers pick
              </label>
              <p className="type-caption text-quiet">
                This sets your preference for when bookings become available.
              </p>
              <div>
                <Button type="submit" variant="primary">
                  Save preference
                </Button>
              </div>
            </form>
          ) : null}
          {d.task === "contact" ? (
            <form method="post" className="grid gap-5">
              <CsrfField token={d.csrf} />
              <input type="hidden" name="intent" value="save" />
              <ChoiceTiles
                legend="Customer details visible to assigned staff"
                name="visibility"
                defaultValue={org.staff_contact_visibility}
                required
                options={[
                  {
                    value: "booking_only",
                    title: "Booking only",
                    description: "Only the information needed for the work.",
                  },
                  {
                    value: "first_name",
                    title: "First name",
                    description:
                      "Booking details and the customer's first name.",
                  },
                  {
                    value: "phone",
                    title: "Phone number",
                    description:
                      "Booking details, first name and phone number.",
                  },
                ]}
              />
              <p className="type-caption text-quiet">
                This preference applies to assigned bookings when bookings
                become available.
              </p>
              <div>
                <Button type="submit" variant="primary">
                  Save preference
                </Button>
              </div>
            </form>
          ) : null}
          {d.task === "profile" ? (
            <form method="post" className="grid gap-5">
              <CsrfField token={d.csrf} />
              <input type="hidden" name="intent" value="save" />
              {org.assign_mode === "customer" ? (
                <TextField
                  label="Your first name"
                  name="firstName"
                  defaultValue={d.profile?.first_name ?? ""}
                  maxLength={60}
                  required
                  hint="Shown to customers when they pick who does the work."
                />
              ) : (
                <p className="type-body">
                  Your business assigns the work. You do not need a public staff
                  name.
                </p>
              )}
              <PickChips
                legend="Which services do you do?"
                name="services"
                multiple
                defaultValue={d.profile?.service_slugs ?? []}
                options={d.services.map((s) => ({
                  value: s.slug,
                  label: s.name,
                }))}
              />
              {d.services.length === 0 ? (
                <StatusNote title="No services set yet">
                  Your business needs to finish its listing before you can
                  choose services.
                </StatusNote>
              ) : null}
              <PickChips
                legend="Which days do you usually work?"
                name="days"
                multiple
                defaultValue={d.profile?.days.map(String) ?? []}
                options={DAYS}
              />
              <p className="type-caption text-quiet">
                These are usual working days, not confirmed availability or
                bookings.
              </p>
              <div>
                <Button type="submit" variant="primary">
                  Save your profile
                </Button>
              </div>
            </form>
          ) : null}
          {d.task === "cover" ? (
            <>
              <p className="type-body">
                The first thing customers see on your listing. It shows as soon
                as you save it. Use a JPEG, PNG or WebP photo of up to 5 MB.
                Location and camera details are removed before it is stored.
              </p>
              {d.covers.length === 0 ? (
                <StatusNote title="No listing yet">
                  Add a cover once your business has a listing.
                </StatusNote>
              ) : null}
              {d.covers.map((l) => (
                <section
                  key={l.public_id}
                  className="cx-cover-item"
                  data-cover-listing={l.public_id}
                >
                  <h2 className="type-title">{l.display_name}</h2>
                  {l.cover !== null ? (
                    <img
                      className="cx-cover-img"
                      src={l.cover}
                      alt={`Cover photo of ${l.display_name}`}
                    />
                  ) : (
                    <p className="type-caption text-quiet">
                      No cover photo yet.
                    </p>
                  )}
                  <form
                    method="post"
                    encType="multipart/form-data"
                    className="grid gap-3"
                  >
                    <CsrfField token={d.csrf} />
                    <input type="hidden" name="intent" value="upload-cover" />
                    <input type="hidden" name="listing" value={l.public_id} />
                    <label className="grid gap-2">
                      <span className="type-label">
                        {l.cover === null
                          ? "Choose a photo"
                          : "Replace the photo"}
                      </span>
                      <input
                        type="file"
                        name="photo"
                        accept="image/jpeg,image/png,image/webp"
                        required
                      />
                    </label>
                    <div>
                      <Button type="submit">Save cover photo</Button>
                    </div>
                  </form>
                  {l.cover !== null ? (
                    <form method="post">
                      <CsrfField token={d.csrf} />
                      <input type="hidden" name="intent" value="remove-cover" />
                      <input type="hidden" name="listing" value={l.public_id} />
                      <button type="submit" className="cx-tlink cx-team-danger">
                        Remove the photo
                      </button>
                    </form>
                  ) : null}
                </section>
              ))}
            </>
          ) : null}
          {d.task === "history" ? (
            d.changes === null ? (
              <StatusNote title="Team history is temporarily unavailable">
                Your access and settings are unchanged. Try again later.
              </StatusNote>
            ) : (
              <>
                <p className="type-body">
                  Recent team and business-setting changes. Personal details and
                  invite secrets are never included.
                </p>
                {d.changes.length === 0 ? (
                  <StatusNote title="No team changes yet" />
                ) : (
                  <ul className="grid gap-3">
                    {d.changes.map((change) => (
                      <li
                        key={change.id}
                        className="rounded-xl bg-[var(--surface)] p-4"
                      >
                        {change.target_table === "memberships"
                          ? "Team access"
                          : change.target_table === "invites"
                            ? "Invite"
                            : change.target_table === "staff_profiles"
                              ? "Staff profile"
                              : "Business settings"}{" "}
                        ·{" "}
                        {change.action === "insert"
                          ? "added"
                          : change.action === "delete"
                            ? "removed"
                            : "updated"}
                        <span className="type-caption text-quiet block">
                          {new Date(change.occurred_at).toLocaleString(
                            "en-ZA",
                            {
                              timeZone: "Africa/Johannesburg",
                            },
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )
          ) : null}
        </div>
      </div>
    </PublicShell>
  );
}
