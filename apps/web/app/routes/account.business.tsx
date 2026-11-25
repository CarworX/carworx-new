import { data } from "react-router";

import { ACCOUNT_NAV } from "../account/forms";
import { throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import { privateHeaders } from "../team/server";
import { setupHref } from "../team/forms";
import { Button, ButtonLink } from "../ui/Button";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import { TabBar } from "../ui/ScrollBar";
import { Icon } from "../ui/Icon";
import "../account/settings.css";
import "../account/business.css";
import type { Route } from "./+types/account.business";

// Finish-build PR 5 (D-098): the Account "Business" tab. Owners hand the
// business to someone on their team (who must accept) and close a listing
// (out of search at once, history kept). Managers see the business links.
// Anyone offered ownership accepts or declines here. Every rule is enforced
// again in the database (20261125120000_business_ownership.sql).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_LABEL = { owner: "Owner", manager: "Manager", staff: "Staff" };
const STATUS_LABEL: Record<string, string> = {
  live: "In search",
  submitted: "Waiting for review",
};

type Role = keyof typeof ROLE_LABEL;

interface Offer {
  organisation_id: string;
  organisation_name: string;
  incoming: boolean;
  other_name: string | null;
  expires_at: string;
}

interface Business {
  id: string;
  name: string;
  role: "owner" | "manager";
  mfaSatisfied: boolean;
  members: { id: string; role: Role; name: string }[];
  listings: { public_id: string; display_name: string; status: string }[];
  closed: { public_id: string; display_name: string }[];
  outgoing: Offer | null;
}

/** A date for display only, in South African time. */
function sastDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "long",
    timeZone: "Africa/Johannesburg",
  }).format(date);
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (r): r is Record<string, unknown> =>
          typeof r === "object" && r !== null,
      )
    : [];
}

export const meta: Route.MetaFunction = () => [
  { title: "Business · CarworX" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  privateHeaders(signedIn.headers);
  const db = signedIn.supabase;
  const [mine, offers] = await Promise.all([
    db.rpc("my_org_memberships"),
    db.rpc("ownership_offers"),
  ]);
  if (mine.error !== null || offers.error !== null)
    throwStatus(503, signedIn.headers);
  const offerRows: Offer[] = rows(offers.data).flatMap((r) =>
    typeof r["organisation_id"] === "string" &&
    typeof r["organisation_name"] === "string" &&
    typeof r["incoming"] === "boolean" &&
    typeof r["expires_at"] === "string"
      ? [
          {
            organisation_id: r["organisation_id"],
            organisation_name: r["organisation_name"],
            incoming: r["incoming"],
            other_name:
              typeof r["other_name"] === "string" ? r["other_name"] : null,
            expires_at: r["expires_at"],
          },
        ]
      : [],
  );
  const runs = rows(mine.data).filter(
    (r) =>
      typeof r["organisation_id"] === "string" &&
      (r["role"] === "owner" || r["role"] === "manager"),
  );
  const businesses: Business[] = [];
  for (const r of runs) {
    const id = r["organisation_id"] as string;
    const role = r["role"] as "owner" | "manager";
    const mfaSatisfied = r["mfa_satisfied"] === true;
    const business: Business = {
      id,
      name: "Your business",
      role,
      mfaSatisfied,
      members: [],
      listings: [],
      closed: [],
      outgoing:
        offerRows.find((o) => !o.incoming && o.organisation_id === id) ?? null,
    };
    businesses.push(business);
    // The business's two-step rule hides its rows until it is met.
    if (!mfaSatisfied) continue;
    const [org, listings, closed, team] = await Promise.all([
      db.from("organisations").select("name").eq("id", id).maybeSingle(),
      db
        .from("listings")
        .select("public_id, display_name, status")
        .eq("organisation_id", id)
        .order("created_at")
        .limit(50),
      db.rpc("closed_listings", { p_org: id }),
      role === "owner"
        ? db.rpc("team_members", { p_org: id })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (
      org.error !== null ||
      listings.error !== null ||
      closed.error !== null ||
      team.error !== null
    )
      throwStatus(503, signedIn.headers);
    const name: unknown = (org.data as { name?: unknown } | null)?.name;
    if (typeof name === "string") business.name = name;
    const all = rows(listings.data).flatMap((l) =>
      typeof l["public_id"] === "string" &&
      typeof l["display_name"] === "string" &&
      typeof l["status"] === "string"
        ? [
            {
              public_id: l["public_id"],
              display_name: l["display_name"],
              status: l["status"],
            },
          ]
        : [],
    );
    const closedIds = new Set(
      rows(closed.data).map((c) => String(c["listing_public_id"])),
    );
    business.listings = all.filter((l) => l.status in STATUS_LABEL);
    business.closed = all.filter((l) => closedIds.has(l.public_id));
    business.members = rows(team.data).flatMap((m) =>
      typeof m["id"] === "string" &&
      m["user_id"] !== signedIn.user.id &&
      (m["role"] === "manager" || m["role"] === "staff")
        ? [
            {
              id: m["id"],
              role: m["role"],
              name:
                typeof m["display_name"] === "string" && m["display_name"]
                  ? m["display_name"]
                  : "Team member",
            },
          ]
        : [],
    );
  }
  return data(
    {
      csrf: context.security.csrfToken,
      businesses,
      incoming: offerRows.filter((o) => o.incoming),
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  privateHeaders(signedIn.headers);
  const form = await request.formData();
  const intent = form.get("intent");
  const reply = (ok: boolean, message: string, status = 200) =>
    data({ ok, message }, { status, headers: signedIn.headers });
  const id = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" && UUID.test(value) ? value : null;
  };
  const failed = (error: { code?: string; message?: string }) => {
    if (error.message === "mfa_required")
      return reply(
        false,
        "This business needs two-step sign-in. Finish it, then try again.",
        403,
      );
    if (error.code === "42501")
      return reply(false, "Only the owner of this business can do that.", 403);
    return reply(false, "We couldn't do that. Please try again.", 503);
  };

  if (intent === "offer-ownership") {
    const org = id("org");
    const membership = id("membership");
    if (org === null || membership === null)
      return reply(false, "Choose who to hand the business to.", 400);
    const offered = await signedIn.supabase.rpc("offer_ownership", {
      p_membership: membership,
    });
    if (offered.error === null)
      return reply(
        true,
        "Offer sent. They'll see it under Account › Business and have 7 days to accept.",
      );
    if (offered.error.message === "offer_pending")
      return reply(
        false,
        "There's already an open offer. Cancel it first to offer someone else.",
        409,
      );
    return failed(offered.error);
  }
  if (intent === "cancel-offer") {
    const org = id("org");
    if (org === null) return reply(false, "Choose a business.", 400);
    const cancelled = await signedIn.supabase.rpc("cancel_ownership_offer", {
      p_org: org,
    });
    if (cancelled.error !== null) return failed(cancelled.error);
    return reply(true, "The offer is cancelled.");
  }
  if (intent === "accept-offer" || intent === "decline-offer") {
    const org = id("org");
    if (org === null) return reply(false, "Choose a business.", 400);
    const answered = await signedIn.supabase.rpc("respond_ownership_offer", {
      p_org: org,
      p_accept: intent === "accept-offer",
    });
    if (answered.error === null)
      return reply(
        true,
        intent === "accept-offer"
          ? "You're now the owner. The previous owner stays on as a manager."
          : "You declined. Nothing has changed.",
      );
    if (answered.error.message === "offer_invalid")
      return reply(
        false,
        "This offer has ended or was cancelled. Nothing has changed.",
        409,
      );
    return failed(answered.error);
  }
  if (intent === "close-listing") {
    const listing = id("listing");
    if (listing === null) return reply(false, "Choose a listing.", 400);
    if (form.get("understand") !== "on")
      return reply(
        false,
        "Tick the box to confirm the listing leaves search.",
        400,
      );
    const closed = await signedIn.supabase.rpc("close_listing", {
      p_listing: listing,
    });
    if (closed.error === null)
      return reply(
        true,
        "The listing is closed and out of search. Its history stays with the business.",
      );
    if (closed.error.message === "listing_suspended")
      return reply(
        false,
        "This listing is suspended by CarworX. Contact us about it instead.",
        409,
      );
    if (closed.error.message === "not_open")
      return reply(false, "This listing isn't in search.", 409);
    return failed(closed.error);
  }
  return reply(false, "Choose an action on this page.", 400);
}

export default function BusinessSettings({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { csrf, businesses, incoming } = loaderData;
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
        <TabBar
          label="Account settings"
          tabs={ACCOUNT_NAV}
          current="business"
        />
        {actionData ? (
          <div role="status">
            <StatusNote
              tone={actionData.ok ? "ok" : "err"}
              title={actionData.message}
            />
          </div>
        ) : null}

        {incoming.map((offer) => (
          <section
            key={offer.organisation_id}
            className="cx-account-box"
            data-offer={offer.organisation_id}
          >
            <h2>{`Become the owner of ${offer.organisation_name}`}</h2>
            <p>
              {`${offer.other_name ?? "The owner"} wants to hand ${offer.organisation_name} to you. You'll become its owner, and ${offer.other_name ?? "they"} will stay on as a manager. The offer ends on ${sastDate(offer.expires_at)}.`}
            </p>
            <div className="cx-account-actions">
              <form method="post">
                <CsrfField token={csrf} />
                <input type="hidden" name="intent" value="accept-offer" />
                <input type="hidden" name="org" value={offer.organisation_id} />
                <Button type="submit" variant="primary" size="sm">
                  Accept ownership
                </Button>
              </form>
              <form method="post">
                <CsrfField token={csrf} />
                <input type="hidden" name="intent" value="decline-offer" />
                <input type="hidden" name="org" value={offer.organisation_id} />
                <Button type="submit" variant="outline" size="sm">
                  Decline
                </Button>
              </form>
            </div>
          </section>
        ))}

        {businesses.length === 0 && incoming.length === 0 ? (
          <section className="cx-account-box">
            <h2>Your business</h2>
            <p>
              You don't own or manage a business on CarworX. Your teams are
              under Your work.
            </p>
            <div>
              <ButtonLink variant="outline" size="sm" href="/account/work">
                Your work
              </ButtonLink>
            </div>
          </section>
        ) : null}

        {businesses.map((b) => (
          <BusinessBoxes key={b.id} business={b} csrf={csrf} />
        ))}
      </div>
    </PublicShell>
  );
}

function Line({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="cx-account-line">
      <div>
        <strong>{title}</strong>
        {hint ? <p>{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function BusinessBoxes({
  business: b,
  csrf,
}: {
  business: Business;
  csrf: string;
}) {
  if (!b.mfaSatisfied)
    return (
      <section className="cx-account-box" data-business={b.id}>
        <h2>{b.name}</h2>
        <p>
          This business asks its {ROLE_LABEL[b.role].toLowerCase()}s to use
          two-step sign-in. Finish it to manage the business.
        </p>
        <div>
          <ButtonLink
            variant="primary"
            size="sm"
            href="/auth/mfa?returnTo=%2Faccount%2Fbusiness"
          >
            Two-step sign-in
          </ButtonLink>
        </div>
      </section>
    );
  const owner = b.role === "owner";
  return (
    <>
      <section className="cx-account-box" data-business={b.id}>
        <h2>{b.name}</h2>
        <Line title="Team and roles" hint="Invite, change roles, remove">
          <a className="cx-account-link" href={setupHref(b.id, "team")}>
            Open
          </a>
        </Line>
        <Line
          title="Who gets the booking"
          hint="Who a new booking goes to on your team"
        >
          <a className="cx-account-link" href={setupHref(b.id, "assign")}>
            Change
          </a>
        </Line>
        {owner ? (
          <Line
            title="What staff can see"
            hint="Customer contact details on bookings"
          >
            <a className="cx-account-link" href={setupHref(b.id, "contact")}>
              Change
            </a>
          </Line>
        ) : null}
        <Line
          title="Listing details"
          hint="Name, services, hours, location, photo"
        >
          <a className="cx-account-link" href={`/provider#business-${b.id}`}>
            Edit
          </a>
        </Line>
        {owner ? (
          <Line title="Payments" hint="Opens with bookings.">
            <span className="cx-account-later">Later</span>
          </Line>
        ) : null}
      </section>

      {owner ? (
        <section className="cx-account-box" data-ownership={b.id}>
          <h2>Ownership</h2>
          <Line
            title="Transfer ownership"
            hint={`Hand ${b.name} to someone on your team. They must accept, and you stay on as a manager.`}
          />
          {b.outgoing ? (
            <div className="cx-account-line" data-outgoing>
              <p>
                {`Offered to ${b.outgoing.other_name ?? "a team member"} until ${sastDate(b.outgoing.expires_at)}.`}
              </p>
              <form method="post">
                <CsrfField token={csrf} />
                <input type="hidden" name="intent" value="cancel-offer" />
                <input type="hidden" name="org" value={b.id} />
                <Button type="submit" variant="outline" size="sm">
                  Cancel offer
                </Button>
              </form>
            </div>
          ) : b.members.length === 0 ? (
            <p className="cx-account-note">
              Add someone to your team first.{" "}
              <a href={setupHref(b.id, "team")}>Invite a person</a>
            </p>
          ) : (
            <form method="post" className="cx-account-transfer">
              <CsrfField token={csrf} />
              <input type="hidden" name="intent" value="offer-ownership" />
              <input type="hidden" name="org" value={b.id} />
              <label className="cx-account-field">
                <span>New owner</span>
                <select name="membership" required defaultValue="">
                  <option value="" disabled>
                    Choose someone on your team
                  </option>
                  {b.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {`${m.name} (${ROLE_LABEL[m.role]})`}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="outline" size="sm">
                Send offer
              </Button>
            </form>
          )}

          <div className="cx-account-sub">
            <Line
              title="Close the business listing"
              hint="Removes it from search at once. Bookings, enquiries and history stay. To come back, send it for review again."
            />
            {b.listings.length === 0 ? (
              <p className="cx-account-note">No listing is in search.</p>
            ) : (
              b.listings.map((l) => (
                <form
                  key={l.public_id}
                  method="post"
                  className="cx-account-close"
                  data-close={l.public_id}
                >
                  <CsrfField token={csrf} />
                  <input type="hidden" name="intent" value="close-listing" />
                  <input type="hidden" name="listing" value={l.public_id} />
                  <div>
                    <strong>{l.display_name}</strong>
                    <p>{STATUS_LABEL[l.status]}</p>
                  </div>
                  <label className="cx-account-check">
                    <input type="checkbox" name="understand" required />
                    <span>I understand it leaves search at once</span>
                  </label>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="danger"
                  >
                    Close listing
                  </Button>
                </form>
              ))
            )}
            {b.closed.map((l) => (
              <p
                key={l.public_id}
                className="cx-account-note"
                data-closed={l.public_id}
              >
                <strong>{l.display_name}</strong> is closed.{" "}
                <a href={`/provider#business-${b.id}`}>Send it for review</a> to
                bring it back.
              </p>
            ))}
          </div>
        </section>
      ) : (
        <section className="cx-account-box">
          <h2>Leave this business</h2>
          <p>The owner will see that you left. Its records stay with it.</p>
          <form method="post" action="/account/work">
            <CsrfField token={csrf} />
            <input type="hidden" name="intent" value="leave" />
            <input type="hidden" name="org" value={b.id} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="danger"
            >
              {`Leave ${b.name}`}
            </Button>
          </form>
        </section>
      )}
    </>
  );
}
