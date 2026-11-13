/**
 * Opening hours after listing (Claude 26 §4b). Owners and managers edit; staff
 * see the hours read-only; anyone else gets a 404. Every read uses the
 * caller's JWT (member RLS) and the write goes through set_listing_hours,
 * which checks the role again in the database. Applies immediately: hours
 * are structured values with no free text, so there's no re-review.
 */
import { data, Form, useNavigation } from "react-router";

import { field } from "../auth/forms";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn, type SignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  localClock,
  openStatus,
  readHours,
  type HoursRow,
} from "../catalogue/hours";
import {
  copyMonday,
  parseHoursForm,
  readRows,
  rowsFromHours,
  type DayRow,
} from "../onboarding/hours";
import { UUID } from "../server/providers/forms";
import { privateHeaders } from "../team/server";
import { Button, ButtonLink } from "../ui/Button";
import { StatusNote } from "../ui/Note";
import { OpeningHoursEditor, OpeningHoursTable } from "../ui/OpeningHours";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/provider.hours.$publicId";

type Role = "owner" | "manager" | "staff";
interface Listing {
  public_id: string;
  organisation_id: string;
  display_name: string;
  status: "draft" | "submitted" | "live" | "suspended";
}
interface Reply {
  problem: string | null;
  rows: DayRow[] | null;
  problems: Record<number, string>;
}

export const meta: Route.MetaFunction = () => [
  { title: "Opening hours · CarworX" },
];
export const headers: Route.HeadersFunction = () => ({
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
});

/** The listing, the caller's role in its organisation, and its saved hours. */
async function load(signedIn: SignedIn, id: string | undefined) {
  privateHeaders(signedIn.headers);
  if (id === undefined || !UUID.test(id)) throwStatus(404, signedIn.headers);
  const db = signedIn.supabase;
  const listing = await db
    .from("listings")
    .select("public_id, organisation_id, display_name, status")
    .eq("public_id", id)
    .maybeSingle()
    .overrideTypes<Listing | null, { merge: false }>();
  if (listing.error !== null) throwStatus(503, signedIn.headers);
  if (listing.data === null) throwStatus(404, signedIn.headers);
  const [membership, saved] = await Promise.all([
    db
      .from("memberships")
      .select("role")
      .eq("organisation_id", listing.data.organisation_id)
      .eq("user_id", signedIn.user.id)
      .eq("status", "active")
      .maybeSingle()
      .overrideTypes<{ role: Role } | null, { merge: false }>(),
    db
      .from("listing_hours")
      .select("day, opens, closes")
      .eq("listing_public_id", id)
      .order("day")
      .overrideTypes<
        { day: number; opens: string; closes: string }[],
        { merge: false }
      >(),
  ]);
  if (membership.error !== null || saved.error !== null)
    throwStatus(503, signedIn.headers);
  // Admins can read listings too, but this page is for the business only.
  if (membership.data === null) throwStatus(404, signedIn.headers);
  // PostgREST sends times as HH:MM:SS.
  const hours = readHours(
    saved.data.map((h) => ({
      day: h.day,
      opens: h.opens.slice(0, 5),
      closes: h.closes.slice(0, 5),
    })),
  );
  if (hours === null) throwStatus(503, signedIn.headers);
  return { listing: listing.data, role: membership.data.role, hours };
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const { listing, role, hours } = await load(signedIn, params.publicId);
  const now = new Date();
  return data(
    {
      csrf: context.security.csrfToken,
      listing,
      role,
      hours,
      today: localClock(now).day,
      status: openStatus(hours, now),
      saved: new URL(request.url).searchParams.get("saved") === "1",
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const { listing, role } = await load(signedIn, params.publicId);
  const reply = (body: Partial<Reply>, status = 200) =>
    data<Reply>(
      { problem: null, rows: null, problems: {}, ...body },
      { status, headers: signedIn.headers },
    );
  if (role === "staff")
    return reply(
      { problem: "Only owners and managers can change opening hours." },
      403,
    );
  const form = await request.formData();
  if (field(form, "hoursAction") === "copy-monday")
    return reply({ rows: copyMonday(readRows(form)) });
  if (field(form, "intent") !== "save")
    return reply({ problem: "Check your answers, then try again." }, 400);
  const parsed = parseHoursForm(form, { requireOpenDay: false });
  if (!parsed.ok)
    return reply(
      {
        problem: "Check the opening hours below.",
        rows: parsed.rows,
        problems: parsed.problems,
      },
      400,
    );
  const result = await signedIn.supabase.rpc("set_listing_hours", {
    p_listing: listing.public_id,
    p: parsed.hours satisfies HoursRow[],
  });
  if (result.error !== null) {
    if (result.error.code === "42501")
      return reply(
        { problem: "Only owners and managers can change opening hours." },
        403,
      );
    if (result.error.code === "22023")
      return reply(
        { problem: "Check the opening hours below.", rows: readRows(form) },
        400,
      );
    return reply(
      {
        problem:
          "We couldn't save your hours just now. Please try again; your saved hours haven't changed.",
        rows: readRows(form),
      },
      503,
    );
  }
  return throwRedirect(
    `/provider/hours/${listing.public_id}?saved=1`,
    signedIn.headers,
  );
}

export default function ListingHours({
  loaderData: d,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const live = d.listing.status === "live";
  return (
    <PublicShell signedIn>
      <div className="mx-auto grid max-w-[760px] gap-5">
        <a className="cx-tlink" href="/provider">
          Your business
        </a>
        <p className="type-label text-quiet">{d.listing.display_name}</p>
        <h1 className="type-display-lg">Opening hours</h1>
        {d.saved && !actionData ? (
          <StatusNote tone="ok" title="Hours saved.">
            {live
              ? "Customers see the new hours on your listing now."
              : "Customers will see them once your listing is live."}
          </StatusNote>
        ) : null}
        {actionData?.problem ? (
          <StatusNote tone="err" title="That didn't work.">
            {actionData.problem}
          </StatusNote>
        ) : null}
        {d.role === "staff" ? (
          <>
            <StatusNote title="View only.">
              Only owners and managers can change opening hours.
            </StatusNote>
            <OpeningHoursTable
              hours={d.hours}
              today={d.today}
              status={d.status}
            />
          </>
        ) : (
          <Form method="post" className="grid gap-5">
            <CsrfField token={d.csrf} />
            <input type="hidden" name="intent" value="save" />
            <p className="type-body">
              Set each day on its own. Switch a day off if you're closed.{" "}
              {live
                ? "Changes show on your public listing straight away."
                : "Customers see these once your listing is live."}
            </p>
            {d.hours.length === 0 && !actionData?.rows ? (
              <StatusNote title="No hours on your listing yet.">
                Customers see "Hours not provided". We've filled in common
                hours to start from: change any day, then save.
              </StatusNote>
            ) : null}
            <OpeningHoursEditor
              key={JSON.stringify(actionData?.rows ?? null)}
              rows={actionData?.rows ?? rowsFromHours(d.hours)}
              problems={actionData?.problems}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
              {live ? (
                <a className="cx-tlink" href={`/p/${d.listing.public_id}#hours`}>
                  See your public listing
                </a>
              ) : (
                <span />
              )}
              <Button
                type="submit"
                variant="primary"
                busy={navigation.state !== "idle"}
              >
                Save hours
              </Button>
            </div>
          </Form>
        )}
        {d.role === "staff" ? (
          <div>
            <ButtonLink href="/provider" variant="outline">
              Back to your business
            </ButtonLink>
          </div>
        ) : null}
      </div>
    </PublicShell>
  );
}
