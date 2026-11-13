import { readTeamChanges, type TeamChange } from "../team/changes";
import { data } from "react-router";

import { field } from "../auth/forms";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  assignment,
  DAYS,
  INVITE_TOKEN,
  inviteRole,
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
  teamServices,
  type StaffProfile,
  type TeamInvite,
  type TeamMembership,
} from "../team/server";
import { Button, ButtonLink } from "../ui/Button";
import { ChoiceTiles, PickChips } from "../ui/Choice";
import { TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/provider.setup.$task.$step";
import { PublicShell } from "../ui/public/PublicShell";

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
  let members: TeamMembership[] = [];
  let invites: TeamInvite[] = [];
  if (params.task === "team") {
    const [people, pending] = await Promise.all([
      signedIn.supabase
        .from("memberships")
        .select("id, organisation_id, user_id, role, status")
        .eq("organisation_id", organisation.id)
        .eq("status", "active")
        .order("created_at")
        .limit(100)
        .overrideTypes<TeamMembership[], { merge: false }>(),
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
    if (people.error !== null || pending.error !== null)
      throwStatus(503, signedIn.headers);
    members = people.data;
    invites = pending.data;
  }
  let changes: TeamChange[] | null = [];
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
  if (params.task === "team") {
    const role = inviteRole(field(form, "role"), membership.role);
    if (role === null) return fail("not_allowed");
    if (intent === "choose-role")
      return throwRedirect(
        `${setupHref(organisation.id, "team", "share")}&role=${role}`,
        signedIn.headers,
      );
    if (intent !== "create-link") return fail("invalid_input");
    const result = await signedIn.supabase.rpc("create_invite", {
      p_org: organisation.id,
      p_role: role,
      p_email: null,
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
      <div className="mx-auto grid max-w-[760px] gap-5">
        <a className="cx-tlink" href="/provider">
          All setup tasks
        </a>
        <p className="type-label text-quiet">{org.name}</p>
        <h1 className="type-display-lg">{TITLES[d.task]}</h1>
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
            <ul className="grid gap-3">
              {d.members.map((member) => (
                <li
                  key={member.id}
                  className="rounded-xl bg-[var(--surface)] p-4"
                >
                  {member.user_id === d.membership.user_id
                    ? "You"
                    : `Team member ${member.id.slice(0, 8)}`}{" "}
                  · {member.role}
                </li>
              ))}
            </ul>
            {d.members.length === 100 ? (
              <p className="type-caption">
                Showing the first 100 active members.
              </p>
            ) : null}
            {d.invites.length > 0 ? (
              <section>
                <h2 className="type-title">Pending invites</h2>
                <ul className="mt-3 grid gap-2">
                  {d.invites.map((invite) => (
                    <li key={invite.id}>
                      {invite.email ?? "One-time link"} · {invite.role} ·
                      expires{" "}
                      {new Date(invite.expires_at).toLocaleDateString("en-ZA", {
                        timeZone: "Africa/Johannesburg",
                      })}
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
                Email delivery is not available here yet; no email will be sent.
              </StatusNote>
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
                  description: "Booking details and the customer's first name.",
                },
                {
                  value: "phone",
                  title: "Phone number",
                  description: "Booking details, first name and phone number.",
                },
              ]}
            />
            <p className="type-caption text-quiet">
              This preference applies to assigned bookings when bookings become
              available.
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
                Your business needs to finish its listing before you can choose
                services.
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
          <StatusNote title="Photo uploads are coming later">
            Your listing stays live without a cover photo. Uploads will open
            after the storage and privacy review.
          </StatusNote>
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
                        {new Date(change.occurred_at).toLocaleString("en-ZA", {
                          timeZone: "Africa/Johannesburg",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        ) : null}
      </div>
    </PublicShell>
  );
}
