import { mailtoHref } from "../ui/mailto";
import { data, Link } from "react-router";

import { field } from "../auth/forms";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  claimCursor,
  CLAIMS_PAGE,
  parseClaimCursor,
  parseId,
  parseDescription,
  parseReason,
  PROBLEM_TEXT,
  problemFrom,
  sast,
  type Problem,
} from "../server/providers/forms";
import { Button, ButtonLink } from "../ui/Button";
import { StatusLabel } from "../ui/Chip";
import { TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/provider";

export const meta: Route.MetaFunction = () => [
  { title: "Your business · CarworX" },
];

interface Membership {
  id: string;
  organisation_id: string;
  user_id: string;
  role: "owner" | "manager" | "staff";
  status: "active" | "revoked";
  created_at: string;
}
interface Listing {
  public_id: string;
  organisation_id: string;
  display_name: string;
  description: string;
  status: "draft" | "submitted" | "live" | "suspended";
  mode: "fixed" | "mobile" | "both";
}
interface Decision {
  listing_public_id: string;
  decision: string;
  reason: string | null;
  decided_at: string;
}
interface Claim {
  id: string;
  listing_public_id: string;
  organisation_id: string;
  claimant_id: string;
  status: string;
  evidence_kind: string;
  email_domain: string | null;
  created_at: string;
}

const CLAIM_COLUMNS =
  "id, listing_public_id, organisation_id, claimant_id, status, evidence_kind, email_domain, created_at";

function pageHref(claims: string | null, enquiries: string | null): string {
  const query = new URLSearchParams();
  if (claims !== null) query.set("claims", claims);
  if (enquiries !== null) query.set("enquiries", enquiries);
  return `/provider${query.size ? `?${query}` : ""}`;
}

const STATUS_COPY: Record<Listing["status"], string> = {
  draft: "Needs changes",
  submitted: "Waiting for review",
  live: "Live",
  suspended: "Suspended",
};

/**
 * /provider: the signed-in person's businesses. Every read uses their own
 * JWT, so RLS decides what appears, and a revoked membership disappears on
 * the next request. Never selects or shows a mobile base or radius (A10).
 */
interface Enquiry {
  id: string;
  listing_public_id: string;
  sender_name: string;
  sender_email: string;
  message: string;
  created_at: string;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const db = signedIn.supabase;
  const uid = signedIn.user.id;
  const url = new URL(request.url);
  const cursor = parseClaimCursor(url.searchParams.get("claims"));
  if (cursor === "invalid") throwStatus(404, signedIn.headers);
  const enquiryCursor = parseClaimCursor(url.searchParams.get("enquiries"));
  if (enquiryCursor === "invalid") throwStatus(404, signedIn.headers);
  const mine = await db
    .from("memberships")
    .select("id, organisation_id, user_id, role, status, created_at")
    .eq("user_id", uid)
    .eq("status", "active")
    .overrideTypes<Membership[], { merge: false }>();
  if (mine.error !== null) throwStatus(503, signedIn.headers);
  const orgIds = mine.data.map((m) => m.organisation_id);
  const controlled = mine.data
    .filter((m) => m.role !== "staff")
    .map((m) => m.organisation_id);
  const owned = mine.data
    .filter((m) => m.role === "owner")
    .map((m) => m.organisation_id);

  const [orgs, listings, members, actionable, own] = await Promise.all([
    db
      .from("organisations")
      .select("id, name")
      .in("id", orgIds)
      .overrideTypes<{ id: string; name: string }[], { merge: false }>(),
    db
      .from("listings")
      .select(
        "public_id, organisation_id, display_name, description, status, mode",
      )
      .in("organisation_id", orgIds)
      .order("created_at")
      .overrideTypes<Listing[], { merge: false }>(),
    db
      .from("memberships")
      .select("id, organisation_id, user_id, role, status, created_at")
      .in("organisation_id", owned)
      .order("created_at")
      .overrideTypes<Membership[], { merge: false }>(),
    // Every claim someone else made that can still be disputed, newest
    // first, a page at a time (keyset on created_at then id, so ties keep a
    // stable order and the server's row cap never hides one). RLS keeps
    // this to claims on my businesses and transfers that displaced me.
    (cursor === null
      ? db.from("listing_claims").select(CLAIM_COLUMNS)
      : db
          .from("listing_claims")
          .select(CLAIM_COLUMNS)
          .or(
            `created_at.lt."${cursor.at}",and(created_at.eq."${cursor.at}",id.lt.${cursor.id})`,
          )
    )
      .in("status", ["submitted", "approved", "disputed"])
      .neq("claimant_id", uid)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(CLAIMS_PAGE + 1)
      .overrideTypes<Claim[], { merge: false }>(),
    db
      .from("listing_claims")
      .select(CLAIM_COLUMNS)
      .eq("claimant_id", uid)
      .order("created_at", { ascending: false })
      .limit(50)
      .overrideTypes<Claim[], { merge: false }>(),
  ]);
  if (
    orgs.error !== null ||
    listings.error !== null ||
    members.error !== null ||
    actionable.error !== null ||
    own.error !== null
  )
    throwStatus(503, signedIn.headers);
  const decisions = await db
    .from("listing_decisions")
    .select("listing_public_id, decision, reason, decided_at")
    .in(
      "listing_public_id",
      listings.data.map((l) => l.public_id),
    )
    .order("decided_at", { ascending: false })
    .overrideTypes<Decision[], { merge: false }>();
  if (decisions.error !== null) throwStatus(503, signedIn.headers);
  // P2-5: enquiries visitors sent to my listings. RLS limits these to owners
  // and managers. Both cursors keep their independent position when paged.
  const enquiryQuery = db
    .from("enquiries")
    .select(
      "id, listing_public_id, sender_name, sender_email, message, created_at",
    );
  if (enquiryCursor !== null)
    enquiryQuery.or(
      `created_at.lt."${enquiryCursor.at}",and(created_at.eq."${enquiryCursor.at}",id.lt.${enquiryCursor.id})`,
    );
  const enquiries = await enquiryQuery
    .in("organisation_id", controlled)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CLAIMS_PAGE + 1)
    .overrideTypes<Enquiry[], { merge: false }>();
  if (enquiries.error !== null) throwStatus(503, signedIn.headers);
  const latest = new Map<string, Decision>();
  for (const d of decisions.data)
    if (!latest.has(d.listing_public_id)) latest.set(d.listing_public_id, d);

  const page = actionable.data.slice(0, CLAIMS_PAGE);
  const last = page.at(-1);
  const lastEnquiry = enquiries.data.slice(0, CLAIMS_PAGE).at(-1);
  return data(
    {
      csrf: context.security.csrfToken,
      uid,
      notice:
        (["applied", "claimed", "done"] as const).find((k) =>
          url.searchParams.has(k),
        ) ?? null,
      orgs: orgs.data.map((o) => ({
        ...o,
        role: mine.data.find((m) => m.organisation_id === o.id)?.role,
        listings: listings.data
          .filter((l) => l.organisation_id === o.id)
          .map((l) => ({ ...l, decision: latest.get(l.public_id) ?? null })),
        members: members.data.filter((m) => m.organisation_id === o.id),
      })),
      // Claims on businesses I control, by other people.
      against: page.filter((c) => controlled.includes(c.organisation_id)),
      // Claims that moved control away from me: I can still dispute them.
      displaced: page.filter(
        (c) =>
          !controlled.includes(c.organisation_id) && c.status === "approved",
      ),
      mineClaims: own.data,
      enquiries: enquiries.data.slice(0, CLAIMS_PAGE).map((e) => ({
        ...e,
        listing:
          listings.data.find((l) => l.public_id === e.listing_public_id)
            ?.display_name ?? "",
      })),
      olderClaims:
        actionable.data.length > CLAIMS_PAGE && last !== undefined
          ? claimCursor(last)
          : null,
      claimsPaged: cursor !== null,
      claimsCursor: url.searchParams.get("claims"),
      enquiryCursor: url.searchParams.get("enquiries"),
      olderEnquiries:
        enquiries.data.length > CLAIMS_PAGE && lastEnquiry !== undefined
          ? claimCursor(lastEnquiry)
          : null,
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const form = await request.formData();
  const intent = field(form, "intent");
  const fail = (problem: Problem) =>
    data(
      { problem },
      {
        status: problem === "unavailable" ? 503 : 400,
        headers: signedIn.headers,
      },
    );
  let result: { error: { code?: string; message?: string } | null };
  if (intent === "dispute") {
    const claim = parseId(form, "claim");
    const reason = parseReason(form, "reason", 10, 1000);
    if (claim === null || reason === null) return fail("invalid_input");
    result = await signedIn.supabase.rpc("dispute_claim", {
      p_claim: claim,
      p_reason: reason,
    });
  } else if (intent === "resubmit") {
    const listing = parseId(form, "listing");
    const name = parseReason(form, "displayName", 2, 160);
    const description = parseDescription(form);
    if (listing === null || name === null || description === null)
      return fail("invalid_input");
    result = await signedIn.supabase.rpc("provider_resubmit", {
      p_listing: listing,
      p_display_name: name,
      p_description: description,
    });
  } else if (intent === "revoke") {
    // Former staff: the owner's own RLS update (memberships_update_owner).
    const membership = parseId(form, "membership");
    if (membership === null) return fail("invalid_input");
    const update = await signedIn.supabase
      .from("memberships")
      .update({ status: "revoked" })
      .eq("id", membership)
      .neq("user_id", signedIn.user.id)
      .select("id");
    result = {
      error:
        update.error ?? (update.data.length === 1 ? null : { code: "42501" }),
    };
  } else {
    return fail("invalid_input");
  }
  if (result.error !== null) return fail(problemFrom(result.error));
  return throwRedirect("/provider?done=1", signedIn.headers);
}

const NOTICE = {
  applied: [
    "Application sent.",
    "An admin will review it. You'll see the outcome here.",
  ],
  claimed: [
    "Claim sent.",
    "An admin will review it. Nothing changes until they do.",
  ],
  done: ["Done.", ""],
} as const;

export default function Provider({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const {
    orgs,
    against,
    displaced,
    mineClaims,
    olderClaims,
    claimsPaged,
    csrf,
    uid,
    notice,
  } = loaderData;
  const names: Record<string, string> = Object.fromEntries(
    orgs.flatMap((o) => o.listings.map((l) => [l.public_id, l.display_name])),
  );
  return (
    <PublicShell signedIn>
      <h1 className="type-display-lg">Your business</h1>
      {notice ? (
        <div className="mt-4 max-w-[65ch]" data-notice={notice}>
          <StatusNote tone="ok" title={NOTICE[notice][0]}>
            {NOTICE[notice][1]}
          </StatusNote>
        </div>
      ) : null}
      {actionData?.problem ? (
        <div className="mt-4 max-w-[65ch]" data-problem={actionData.problem}>
          <StatusNote tone="err" title="That didn't work.">
            {PROBLEM_TEXT[actionData.problem]}
          </StatusNote>
        </div>
      ) : null}

      {orgs.length === 0 ? (
        <div className="mt-6 max-w-[65ch]">
          <StatusNote title="No business yet.">
            List your business for free. An admin checks it first.
          </StatusNote>
        </div>
      ) : null}
      <div className="mt-6">
        <ButtonLink href="/provider/apply" arrow>
          List a business
        </ButtonLink>
      </div>

      {orgs.map((org) => (
        <section key={org.id} className="mt-10" data-org={org.id}>
          <h2 className="type-title">{org.name}</h2>
          {org.listings.map((l) => (
            <article
              key={l.public_id}
              className="rounded-2xl bg-[var(--surface)] mt-4 grid gap-3 p-4"
              data-listing={l.public_id}
              data-status={l.status}
            >
              <div className="flex flex-wrap items-center gap-2">
                <b>{l.display_name}</b>
                <StatusLabel
                  tone={
                    l.status === "live"
                      ? "ok"
                      : l.status === "suspended"
                        ? "err"
                        : "warn"
                  }
                >
                  {STATUS_COPY[l.status]}
                </StatusLabel>
              </div>
              <p className="type-body">
                {l.mode === "fixed"
                  ? "Customers visit your workshop."
                  : l.mode === "both"
                    ? "Customers visit your workshop, and you also go to them. Your service distance stays private."
                    : "You go to customers. Your base and distance stay private."}
              </p>
              {l.decision?.reason ? (
                <p className="type-body" data-decision={l.decision.decision}>
                  <b>Admin note:</b> {l.decision.reason}
                </p>
              ) : null}
              {l.status === "live" ? (
                <a className="cx-tlink" href={`/p/${l.public_id}`}>
                  View your public listing
                </a>
              ) : null}
              {l.status === "draft" && org.role !== "staff" ? (
                <form method="post" className="grid gap-3">
                  <CsrfField token={csrf} />
                  <input type="hidden" name="intent" value="resubmit" />
                  <input type="hidden" name="listing" value={l.public_id} />
                  <TextField
                    label="Business name"
                    name="displayName"
                    defaultValue={l.display_name}
                    required
                    maxLength={160}
                  />
                  <div className="cx-field">
                    <label htmlFor={`d-${l.public_id}`}>What you do</label>
                    <textarea
                      id={`d-${l.public_id}`}
                      name="description"
                      className="cx-input"
                      defaultValue={l.description}
                      required
                      minLength={10}
                      maxLength={2000}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Button type="submit">Send for review again</Button>
                  </div>
                </form>
              ) : null}
            </article>
          ))}
          {org.role === "owner" ? (
            <div className="mt-4">
              <h3 className="type-label">People with access</h3>
              <ul className="mt-2 grid gap-2">
                {org.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center gap-3"
                    data-member={m.id}
                    data-member-status={m.status}
                  >
                    <span>
                      {m.user_id === uid
                        ? "You"
                        : `Team member ${m.id.slice(0, 8)}`}{" "}
                      · {m.role} ·{" "}
                      {m.status === "active" ? "active" : "removed"}
                    </span>
                    {m.status === "active" && m.user_id !== uid ? (
                      <form method="post">
                        <CsrfField token={csrf} />
                        <input type="hidden" name="intent" value="revoke" />
                        <input type="hidden" name="membership" value={m.id} />
                        <Button type="submit" size="sm">
                          Remove access
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ))}

      {[...against, ...displaced].length > 0 ||
      olderClaims !== null ||
      claimsPaged ? (
        <section className="mt-10" data-claims-section>
          <h2 className="type-title">Claims on your business</h2>
          {[...against, ...displaced].map((c) => (
            <article
              key={c.id}
              className="rounded-2xl bg-[var(--surface)] mt-4 grid gap-3 p-4"
              data-claim={c.id}
              data-claim-status={c.status}
            >
              <p className="type-body">
                Someone asked to manage{" "}
                <b>
                  {names[c.listing_public_id] ??
                    `listing ${c.listing_public_id.slice(0, 8)}`}
                </b>{" "}
                (
                {c.evidence_kind === "business_email"
                  ? `business email at ${c.email_domain ?? ""}`
                  : "document for an admin to review"}
                ). Status: {c.status}.
              </p>
              {c.status === "submitted" || c.status === "approved" ? (
                <form method="post" className="grid gap-3">
                  <CsrfField token={csrf} />
                  <input type="hidden" name="intent" value="dispute" />
                  <input type="hidden" name="claim" value={c.id} />
                  <TextField
                    label="Why this claim is wrong"
                    name="reason"
                    required
                    minLength={10}
                    maxLength={1000}
                  />
                  <div>
                    <Button type="submit">Dispute this claim</Button>
                  </div>
                </form>
              ) : null}
            </article>
          ))}
          <nav className="mt-4 flex flex-wrap gap-4" aria-label="More claims">
            {claimsPaged ? (
              <Link
                to={pageHref(null, loaderData.enquiryCursor)}
                data-claims-newest
              >
                Back to the newest claims
              </Link>
            ) : null}
            {olderClaims !== null ? (
              <Link
                to={pageHref(olderClaims, loaderData.enquiryCursor)}
                data-claims-older
              >
                Show older claims
              </Link>
            ) : null}
          </nav>
        </section>
      ) : null}

      {loaderData.enquiries.length > 0 || loaderData.enquiryCursor !== null ? (
        <section className="mt-10" data-enquiries>
          <h2 className="type-title">Enquiries</h2>
          <p className="type-body-sm text-quiet mt-1">
            Messages visitors sent from your listings. Reply by email. CarworX
            deletes them after 12 months.
          </p>
          <ul className="mt-3 grid gap-3">
            {loaderData.enquiries.map((e) => (
              <li
                key={e.id}
                className="rounded-2xl bg-[var(--surface)] p-4"
                data-enquiry={e.id}
              >
                <p className="type-body">
                  <b>{e.sender_name}</b> ·{" "}
                  <a className="cx-tlink" href={mailtoHref(e.sender_email)}>
                    {e.sender_email}
                  </a>
                </p>
                <p className="type-caption">
                  {e.listing} · {sast(e.created_at)}
                </p>
                <p className="type-body mt-2 whitespace-pre-line">
                  {e.message}
                </p>
              </li>
            ))}
          </ul>
          <nav
            aria-label="More enquiries"
            className="mt-4 flex flex-wrap gap-4"
          >
            {loaderData.enquiryCursor !== null ? (
              <Link to={pageHref(loaderData.claimsCursor, null)}>
                Newest enquiries
              </Link>
            ) : null}
            {loaderData.olderEnquiries !== null ? (
              <Link
                data-enquiries-older
                to={pageHref(
                  loaderData.claimsCursor,
                  loaderData.olderEnquiries,
                )}
              >
                Show older enquiries
              </Link>
            ) : null}
          </nav>
        </section>
      ) : null}

      {mineClaims.length > 0 ? (
        <section className="mt-10">
          <h2 className="type-title">Your claims</h2>
          <ul className="mt-2 grid gap-2">
            {mineClaims.map((c) => (
              <li key={c.id} data-my-claim={c.id} data-claim-status={c.status}>
                Listing {c.listing_public_id.slice(0, 8)}: {c.status}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PublicShell>
  );
}
