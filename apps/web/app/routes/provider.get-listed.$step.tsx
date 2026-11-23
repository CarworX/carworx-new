import { useRef, useState } from "react";
import { data, Form, useNavigate, useNavigation } from "react-router";
import { field, isTicked } from "../auth/forms";
import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  getStep,
  incompleteStep,
  METROS,
  NOTICE_VERSION,
  parseStep,
  STEPS,
  type Draft,
  type Step,
} from "../onboarding/draft";
import { lookupPlace, pickerImage } from "../onboarding/geo.server";
import {
  copyMonday,
  HOUR_TIMES,
  parseHoursForm,
  readRows,
  shortHours,
  type DayRow,
} from "../onboarding/hours";
import { inSouthAfrica } from "../onboarding/map";
import { PinPicker, type GeoReply } from "../onboarding/PinPicker";
import { SERVICE_OPTIONS } from "../server/providers/forms";
import {
  checkQuota,
  checkSearchLimits,
  type LimiterNamespace,
} from "../server/search/limiter";
import { hoursSummary } from "../ui/OpeningHours";
import { StatusNote } from "../ui/Note";
import {
  ObActions,
  ObIcon,
  ObListingCard,
  ObNav,
  ObPicks,
  ObQ,
  ObRail,
  ObTiles,
  SegBar,
  type RailItem,
} from "../sites/onboarding/kit";
import kitCss from "../sites/onboarding/kit.css?url";
import applyCss from "../sites/onboarding/apply.css?url";
import extraCss from "../sites/onboarding/extra.css?url";
import type { Route } from "./+types/provider.get-listed.$step";

const DRAFT_COLUMNS =
  "id, business_name, applicant_role, service_slugs, mode, metro, public_address, pin_lat, pin_lng, pin_source, radius_km, description, hours, team_size_band, trading_since, step";
const RAIL: readonly RailItem[] = [
  {
    key: "business",
    title: "Business",
    body: "Name and your role",
    icon: "store",
  },
  {
    key: "service",
    title: "Service",
    body: "What you offer and how",
    icon: "team",
  },
  {
    key: "location",
    title: "Location",
    body: "Metro, pin or travel area",
    icon: "pin",
  },
  {
    key: "about",
    title: "About",
    body: "Hours and one line about you",
    icon: "clock",
  },
  { key: "check", title: "Check", body: "Everything on one page", icon: "eye" },
];
interface MapEnv {
  MAPBOX_SERVER_TOKEN?: string;
  SEARCH_LIMITER?: LimiterNamespace;
  SEARCH_LIMITER_SALT?: string;
}
const path = (step: Step | "submitted") => `/provider/get-listed/${step}`;
/** The About step redraws the hours (and the typed description) it was sent. */
interface HoursReply {
  rows: DayRow[];
  problems: Record<number, string>;
  /** New per response, so a repeated copy still resets edited fields. */
  version: string;
  description: string;
}
const EMPTY_REPLY: GeoReply & { hours: HoursReply | null } = {
  problem: null,
  candidates: null,
  map: null,
  hours: null,
};
const MESSAGES = {
  invalid:
    "Check your answers, then try again. Choose a location before continuing.",
  unavailable:
    "We couldn't save this just now. Please try again; your previously saved answers are safe.",
  application_pending:
    "Your business is already waiting for review. Open your business dashboard for its status.",
  consent_required:
    "Confirm that you are 18 or older and, for mobile services, acknowledge the location notice.",
  draft_incomplete:
    "Some details are missing. Go back through the steps before sending.",
} as const;

/** "2026-11-17 09:04 SAST": South African time, which has no DST. */
function sastStamp(iso: string | undefined): string | null {
  const ms = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(ms)) return null;
  return `${new Date(ms + 2 * 3_600_000).toISOString().slice(0, 16).replace("T", " ")} SAST`;
}

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: kitCss },
  { rel: "stylesheet", href: applyCss },
  { rel: "stylesheet", href: extraCss },
];
export const meta: Route.MetaFunction = () => [
  { title: "Get your business listed · CarworX" },
];
export const headers: Route.HeadersFunction = () => ({
  "Cache-Control": "private, no-store",
});

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const step = params.step === "submitted" ? "submitted" : getStep(params.step);
  if (!step) throwStatus(404, signedIn.headers);
  const rows = await signedIn.supabase
    .from("provider_applications")
    .select(DRAFT_COLUMNS)
    .eq("user_id", signedIn.user.id)
    .is("submitted_at", null)
    .limit(1)
    .overrideTypes<Draft[], { merge: false }>();
  if (rows.error) throwStatus(503, signedIn.headers);
  const draft = rows.data[0] ?? null;
  let status: string | null = null;
  let listingId: string | null = null;
  let sentAt: string | null = null;
  if (step === "submitted") {
    const submitted = await signedIn.supabase
      .from("provider_applications")
      .select("submitted_listing_public_id, submitted_at")
      .eq("user_id", signedIn.user.id)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .overrideTypes<
        { submitted_listing_public_id: string; submitted_at: string }[],
        { merge: false }
      >();
    if (submitted.error) throwStatus(503, signedIn.headers);
    listingId = submitted.data[0]?.submitted_listing_public_id ?? null;
    sentAt = sastStamp(submitted.data[0]?.submitted_at);
    if (!listingId) return throwRedirect(path("business"), signedIn.headers);
    const listing = await signedIn.supabase
      .from("listings")
      .select("status")
      .eq("public_id", listingId)
      .limit(1)
      .overrideTypes<{ status: string }[], { merge: false }>();
    if (listing.error) throwStatus(503, signedIn.headers);
    status = listing.data[0]?.status ?? "submitted";
  } else {
    const missing = incompleteStep(draft);
    if (
      missing &&
      STEPS.findIndex((candidate) => candidate === step) >
        STEPS.indexOf(missing)
    )
      return throwRedirect(path(missing), signedIn.headers);
  }
  const env = context.cloudflare.env as unknown as MapEnv;
  signedIn.headers.set("Cache-Control", "private, no-store");
  return data(
    {
      csrf: context.security.csrfToken,
      draft,
      step,
      status,
      listingId,
      sentAt,
      mapEnabled:
        typeof env.MAPBOX_SERVER_TOKEN === "string" &&
        env.MAPBOX_SERVER_TOKEN.length >= 20,
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const step = getStep(params.step);
  if (!step) throwStatus(404, signedIn.headers);
  signedIn.headers.set("Cache-Control", "private, no-store");
  const reply = (problem: string, status = 400) =>
    data({ ...EMPTY_REPLY, problem }, { status, headers: signedIn.headers });
  const form = await request.formData();
  const intent = field(form, "intent");
  if (intent === "locate" || intent === "map") {
    if (step !== "location") return reply(MESSAGES.invalid);
    const env = context.cloudflare.env as unknown as MapEnv;
    const token = env.MAPBOX_SERVER_TOKEN;
    if (typeof token !== "string" || token.length < 20)
      return reply(
        "Map search is temporarily unavailable. Use your device location or try again later.",
        503,
      );
    const limit = await checkSearchLimits(
      env.SEARCH_LIMITER,
      env.SEARCH_LIMITER_SALT,
      request.headers.get("CF-Connecting-IP") ?? "unknown",
      signedIn.user.id,
    );
    if (limit.kind !== "allowed")
      return reply(
        "Map search is temporarily unavailable. Try again shortly.",
        limit.kind === "limited" ? 429 : 503,
      );
    if (
      (
        await checkQuota(
          env.SEARCH_LIMITER,
          intent === "locate" ? "geocode" : "map",
        )
      ).kind !== "allowed"
    )
      return reply(
        "Map search is temporarily unavailable. Try again later.",
        503,
      );
    if (intent === "locate") {
      const candidates = await lookupPlace(field(form, "place"), token);
      if (!candidates)
        return reply(
          "We couldn't find that place just now. Try again or use your device location.",
          503,
        );
      return data(
        { ...EMPTY_REPLY, candidates },
        { headers: signedIn.headers },
      );
    }
    const lat = field(form, "lat"),
      lng = field(form, "lng");
    if (!lat.trim() || !lng.trim()) return reply(MESSAGES.invalid);
    const centre = { lat: Number(lat), lng: Number(lng) };
    if (!inSouthAfrica(centre)) return reply(MESSAGES.invalid);
    const image = await pickerImage(centre, token);
    if (!image)
      return reply(
        "The map couldn't load. Try again or use your device location.",
        503,
      );
    return data(
      { ...EMPTY_REPLY, map: { image, centre } },
      { headers: signedIn.headers },
    );
  }
  if (intent !== "save" && intent !== "submit") return reply(MESSAGES.invalid);
  if (step === "check") {
    if (intent !== "submit") return reply(MESSAGES.invalid);
    if (!isTicked(form, "adult")) return reply(MESSAGES.consent_required);
    const { error } = await signedIn.supabase.rpc("provider_submit", {
      p_adult: true,
      p_probing_ack: isTicked(form, "probing"),
      p_notice: NOTICE_VERSION,
    });
    if (error)
      return reply(
        (MESSAGES as Readonly<Record<string, string>>)[error.message] ??
          MESSAGES.unavailable,
        error.code === "P0001" ? 400 : 503,
      );
    return throwRedirect(path("submitted"), signedIn.headers);
  }
  if (intent !== "save") return reply(MESSAGES.invalid);
  if (step === "about") {
    const description = field(form, "description");
    // "Copy Monday to weekdays" redraws the form; nothing is saved.
    if (field(form, "hoursAction") === "copy-monday")
      return data(
        {
          ...EMPTY_REPLY,
          hours: {
            rows: copyMonday(readRows(form)),
            version: crypto.randomUUID(),
            problems: {},
            description,
          },
        },
        { headers: signedIn.headers },
      );
    const hours = parseHoursForm(form, { requireOpenDay: true });
    if (!hours.ok)
      return data(
        {
          ...EMPTY_REPLY,
          problem: "Check the opening hours below.",
          hours: {
            rows: hours.rows,
            problems: hours.problems,
            description,
            version: crypto.randomUUID(),
          },
        },
        { status: 400, headers: signedIn.headers },
      );
  }
  if (step === "location") {
    // Mode belongs to this person's saved draft; a hidden field is not authoritative.
    const current = await signedIn.supabase
      .from("provider_applications")
      .select("mode")
      .eq("user_id", signedIn.user.id)
      .is("submitted_at", null)
      .limit(1)
      .overrideTypes<
        { mode: "fixed" | "mobile" | "both" | null }[],
        { merge: false }
      >();
    if (current.error) return reply(MESSAGES.unavailable, 503);
    const mode = current.data[0]?.mode;
    if (!mode) return reply(MESSAGES.invalid);
    form.set("mode", mode);
  }
  const patch = parseStep(
    form,
    step,
    SERVICE_OPTIONS.map((s) => s.slug),
  );
  if (!patch) return reply(MESSAGES.invalid);
  const { error } = await signedIn.supabase.rpc("provider_save_draft", {
    p: patch,
  });
  if (error)
    return reply(MESSAGES.unavailable, error.code === "22023" ? 400 : 503);
  const next = STEPS[STEPS.indexOf(step) + 1];
  // "Save and exit" posts the step with exit=1: saved, then back to the dashboard.
  if (field(form, "exit") === "1")
    return throwRedirect("/provider", signedIn.headers);
  return throwRedirect(path(next ?? "check"), signedIn.headers);
}

export default function GetListed(props: Route.ComponentProps) {
  return <Application key={props.loaderData.step} {...props} />;
}

const HEADS: Record<Step, { eyebrow: string; title: string }> = {
  business: { eyebrow: "Step 1 · Business", title: "Tell us who you are" },
  service: { eyebrow: "Step 2 · Service", title: "What you offer" },
  location: { eyebrow: "Step 3 · Location", title: "Where customers find you" },
  about: { eyebrow: "Step 4 · About", title: "Hours and a line about you" },
  check: { eyebrow: "Check", title: "Is this right?" },
};
const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "other", label: "I help run it" },
] as const;
const TEAM = [
  { value: "solo", label: "Just me" },
  { value: "2-5", label: "2–5" },
  { value: "6-15", label: "6–15" },
  { value: "16+", label: "16+" },
] as const;
const PHRASES = [
  "Hand wash only",
  "Same-day service",
  "Free written quotes",
  "Family-run",
  "Eco-friendly products",
  "Secure parking while you wait",
  "Fleet work welcome",
] as const;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
/** The preview's time list (05:00–22:00), plus a saved time outside it. */
function timeOptions(saved: string): string[] {
  const list = HOUR_TIMES.filter((t) => t >= "05:00" && t <= "22:00");
  return list.includes(saved) ? list : [...list, saved].sort();
}
const serviceLabel = (slug: string) =>
  SERVICE_OPTIONS.find((s) => s.slug === slug)?.label ?? slug;

/** What customers will read for "where": never a mobile base. */
function publicWhere(mode: Draft["mode"] | undefined, metro: string): string {
  if (mode === "both") return `${metro || "Your area"} · also comes to you`;
  if (mode === "mobile") return `Comes to you · ${metro || "your metro"}`;
  return metro;
}

function Application({ loaderData, actionData }: Route.ComponentProps) {
  const { draft, step, csrf } = loaderData;
  const navigation = useNavigation();
  const navigate = useNavigate();
  const busy = navigation.state !== "idle";
  const [previewName, setPreviewName] = useState(draft?.business_name ?? "");
  const [previewServices, setPreviewServices] = useState<readonly string[]>(
    draft?.service_slugs ?? [],
  );
  const [previewMetro, setPreviewMetro] = useState(draft?.metro ?? "");
  const [radius, setRadius] = useState(draft?.radius_km ?? 25);
  const [about, setAbout] = useState(
    actionData?.hours?.description ?? draft?.description ?? "",
  );
  const aboutRef = useRef<HTMLTextAreaElement>(null);

  if (step === "submitted") {
    const live = loaderData.status === "live";
    const heading = live
      ? "You're live"
      : loaderData.status === "draft"
        ? "Your application needs a change"
        : loaderData.status === "suspended"
          ? "Your listing is paused"
          : "Application sent";
    return (
      <div className="ob-apply cx-canvas ob-page">
        <ObNav
          label="Business application"
          exitHref="/provider"
          exitText="Business dashboard"
        />
        <main id="main" className="shell">
          <div className="steps" style={{ gridColumn: "1 / -1" }}>
            <div className="card">
              <div className="ob-status">
                <div className="ob-tickbig">
                  <ObIcon name="tick" />
                </div>
                <p className="cx-eyebrow">
                  {live
                    ? "Live · In search now"
                    : loaderData.sentAt
                      ? `Sent · ${loaderData.sentAt}`
                      : "Sent"}
                </p>
                <h1 className="t-head">{heading}</h1>
                <p className="t-lede">
                  {live
                    ? "Customers can find your listing. Finish setup to get your team ready."
                    : loaderData.status === "draft" ||
                        loaderData.status === "suspended"
                      ? "Open your business dashboard to see its current review status and any feedback. Only an approved listing appears in search."
                      : "A CarworX admin checks every application before it appears in search. Open your business dashboard to see the review status and any feedback."}
                </p>
                {live ||
                loaderData.status === "draft" ||
                loaderData.status === "suspended" ? null : (
                  <>
                    <h2 className="t-title" style={{ marginTop: 8 }}>
                      What happens next
                    </h2>
                    <ol className="cx-steps">
                      <li>
                        <span className="k">
                          <span className="n" aria-hidden="true">
                            01
                          </span>
                          <ObIcon name="tick" />
                        </span>
                        <div>
                          <span className="cx-actor">You</span>
                          <b>Sent</b>
                          <p>
                            Your answers are saved. Your business dashboard
                            shows the review status.
                          </p>
                        </div>
                      </li>
                      <li aria-current="step">
                        <span className="k">
                          <span className="n" aria-hidden="true">
                            02
                          </span>
                          <ObIcon name="eye" />
                        </span>
                        <div>
                          <span className="cx-actor carworx">CarworX</span>
                          <b>An admin checks it</b>
                          <p>
                            By phone, your documents or a visit. Each check
                            becomes a label: Identity checked, Business details
                            checked
                            {draft?.mode !== "mobile"
                              ? ", Premises visited"
                              : ""}
                            .
                          </p>
                        </div>
                      </li>
                      <li>
                        <span className="k">
                          <span className="n" aria-hidden="true">
                            03
                          </span>
                          <ObIcon name="flag" />
                        </span>
                        <div>
                          <span className="cx-actor">You</span>
                          <b>You&apos;re live</b>
                          <p>
                            Your listing appears in search with the labels you
                            earned.
                          </p>
                        </div>
                      </li>
                    </ol>
                  </>
                )}
              </div>
              <div className="ob-actions">
                {live && loaderData.listingId ? (
                  <a
                    className="cx-btn outlined"
                    href={`/p/${loaderData.listingId}`}
                  >
                    View listing
                  </a>
                ) : null}
                <a className="cx-btn primary" href="/provider">
                  {live ? "Finish setup" : "Go to your dashboard"}
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const current = (STEPS as readonly string[]).indexOf(step);
  const head = HEADS[step as Step];
  const previous = STEPS[current - 1];
  const mode = draft?.mode ?? null;
  const work = mode === "both" ? ["fixed", "mobile"] : mode ? [mode] : [];
  const rows: DayRow[] | null = actionData?.hours?.rows ?? null;
  const savedHours = draft?.hours ?? [];
  const openDays = rows
    ? rows.filter((r) => r.open).map((r) => r.day)
    : savedHours.length
      ? savedHours.map((h) => h.day)
      : [1, 2, 3, 4, 5];
  const firstOpen = rows?.find((r) => r.open);
  const opens = firstOpen?.opens ?? savedHours[0]?.opens ?? "08:00";
  const closes = firstOpen?.closes ?? savedHours[0]?.closes ?? "17:00";
  const hoursProblem = actionData?.hours
    ? Object.values(actionData.hours.problems)[0]
    : undefined;
  const hoursText = shortHours(savedHours, hoursSummary);
  const today = new Date().toISOString().slice(0, 10);

  const card = (
    <ObListingCard
      name={previewName}
      where={publicWhere(mode, previewMetro)}
      services={previewServices.map(serviceLabel)}
      about={draft?.description ?? ""}
      hours={hoursText || "Mon–Fri · 08:00–17:00"}
    />
  );
  const formId = "application-step";
  const actions = (
    <ObActions
      backHref={previous ? path(previous) : "/provider"}
      cta={step === "check" ? "Send application" : "Next"}
      busy={busy}
      form={formId}
    />
  );

  return (
    <div
      className="ob-apply cx-canvas ob-page"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !previous) return;
        const t = event.target as HTMLElement;
        if (t.closest(".ob-perm, .ob-results")) return;
        event.preventDefault();
        void navigate(path(previous));
      }}
    >
      {/* Enter submits a form through its first submit button in page
          order: keep that "Next", not "Save and exit" in the bar. */}
      <button
        type="submit"
        form={formId}
        className="cx-vh"
        tabIndex={-1}
        aria-hidden="true"
      >
        Next
      </button>
      {/* Steps 1–4 save before leaving; Check has nothing unsaved and its
          form would send the application, so it just leaves. */}
      <ObNav
        label="Business application"
        exitHref="/provider"
        saveForm={step === "check" ? undefined : formId}
        exitText={step === "check" ? "Exit" : "Save and exit"}
      />
      <h1 className="cx-vh">Get your business listed</h1>
      <main id="main" className="shell">
        <aside className="rail" aria-label="Your progress">
          <p className="state">List your business</p>
          <ObRail items={RAIL} current={current} />
          <div className="phase1-card">
            <p className="cx-eyebrow">
              Your live listing preview · not public yet
            </p>
            {card}
          </div>
        </aside>
        <div className="steps">
          <details className="phase1-mobile-preview">
            <summary>Your listing preview</summary>
            <div className="phase1-card">
              <p className="cx-eyebrow">
                Your live listing preview · not public yet
              </p>
              {card}
            </div>
          </details>
          <SegBar
            className="segtop"
            name={RAIL[current]?.title ?? "Business"}
            at={current}
            total={STEPS.length}
            label="Application progress"
          />
          {actionData?.problem ? (
            <div className="ob-problem">
              <StatusNote tone="err" title="We couldn't continue.">
                {actionData.problem}
              </StatusNote>
            </div>
          ) : null}
          <section aria-labelledby="step-title">
            <div className="card">
              <div className="head">
                <p className="cx-eyebrow">{head.eyebrow}</p>
                <h2 id="step-title">{head.title}</h2>
                {step === "check" ? (
                  <p className="t-cap">
                    Tap Change to fix anything. You&apos;ll come back through
                    the steps.
                  </p>
                ) : null}
              </div>
              <Form
                id={formId}
                method="post"
                className="ob-form"
                onChange={(event) => {
                  const answers = new FormData(event.currentTarget);
                  const name = answers.get("businessName");
                  if (typeof name === "string") setPreviewName(name);
                  if (step === "service")
                    setPreviewServices(
                      answers
                        .getAll("services")
                        .filter(
                          (value): value is string => typeof value === "string",
                        ),
                    );
                  const metro = answers.get("metro");
                  if (typeof metro === "string") setPreviewMetro(metro);
                }}
              >
                <CsrfField token={csrf} />
                <input
                  type="hidden"
                  name="intent"
                  value={step === "check" ? "submit" : "save"}
                />
                {step === "business" ? (
                  <>
                    <ObQ id="path" title="What would you like to do?">
                      <div className="ob-tiles">
                        <label className="ob-tile">
                          <input
                            type="radio"
                            value="new"
                            defaultChecked
                            readOnly
                          />
                          <span className="ic">
                            <ObIcon name="plus" />
                          </span>
                          <b>List a new business</b>
                          <small>Start fresh. Takes about 2 minutes.</small>
                        </label>
                        <a
                          className="ob-tile"
                          href="/provider/get-listed/claim"
                        >
                          <span className="ic">
                            <ObIcon name="flag" />
                          </span>
                          <b>Claim an existing listing</b>
                          <small>
                            Find your business on CarworX and request access.
                          </small>
                        </a>
                      </div>
                    </ObQ>
                    <ObQ
                      id="name"
                      group={false}
                      htmlFor="f-name"
                      title="What's your business called?"
                      hint="As customers know it."
                    >
                      <input
                        className="ob-input"
                        id="f-name"
                        name="businessName"
                        type="text"
                        minLength={2}
                        maxLength={160}
                        required
                        autoComplete="organization"
                        placeholder="For example, Shine Bay Car Wash"
                        aria-describedby="q-name-h"
                        defaultValue={draft?.business_name ?? ""}
                      />
                    </ObQ>
                    <ObQ
                      id="role"
                      title="What's your role?"
                      hint="You must be authorised to list the business. If approved, you become its CarworX account owner."
                    >
                      <ObPicks
                        name="role"
                        required
                        options={ROLES}
                        defaultValue={draft?.applicant_role ?? ""}
                      />
                    </ObQ>
                  </>
                ) : null}
                {step === "service" ? (
                  <>
                    <ObQ
                      id="services"
                      title="What services do you offer?"
                      hint="Pick all that apply. The first one you pick is your main service."
                    >
                      <ObPicks
                        name="services"
                        multiple
                        options={SERVICE_OPTIONS.map((s) => ({
                          value: s.slug,
                          label: s.label,
                        }))}
                        defaultValue={draft?.service_slugs ?? []}
                      />
                    </ObQ>
                    <ObQ
                      id="mode"
                      title="Where do you serve customers?"
                      hint="Pick one or both. Many businesses have a workshop and do call-outs too."
                    >
                      <ObTiles
                        name="work"
                        multiple
                        defaultValue={work}
                        options={[
                          {
                            value: "fixed",
                            title: "They come to me",
                            description:
                              "A workshop or wash bay customers drive to.",
                            icon: "store",
                          },
                          {
                            value: "mobile",
                            title: "I go to them",
                            description: "Mobile: you travel to the customer.",
                            icon: "van",
                          },
                        ]}
                      />
                    </ObQ>
                    <ObQ id="staff" title="How many people work there?">
                      <ObPicks
                        name="team"
                        required
                        options={TEAM}
                        defaultValue={draft?.team_size_band ?? ""}
                      />
                    </ObQ>
                  </>
                ) : null}
                {step === "location" ? (
                  <>
                    <input type="hidden" name="mode" value={mode ?? ""} />
                    <ObQ
                      id="metro"
                      group={false}
                      htmlFor="f-metro"
                      title="Which metro or area?"
                    >
                      <select
                        className="ob-input"
                        id="f-metro"
                        name="metro"
                        required
                        defaultValue={draft?.metro ?? ""}
                      >
                        <option value="">Choose…</option>
                        {METROS.map((metro) => (
                          <option key={metro}>{metro}</option>
                        ))}
                      </select>
                    </ObQ>
                  </>
                ) : null}
                {step === "about" ? (
                  <>
                    <ObQ
                      id="hours"
                      title="When are you open?"
                      hint="Tap the days you work. You can add exceptions later."
                      error={hoursProblem}
                    >
                      <div className="ob-days">
                        {DAYS.map((label, i) => (
                          <label key={label} className="ob-day">
                            <input
                              type="checkbox"
                              name={`open-${String(i + 1)}`}
                              value="on"
                              defaultChecked={openDays.includes(i + 1)}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="ob-times">
                        <label>
                          Opens
                          <select
                            className="ob-input"
                            name="opens"
                            defaultValue={opens}
                          >
                            {timeOptions(opens).map((t) => (
                              <option key={t}>{t}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Closes
                          <select
                            className="ob-input"
                            name="closes"
                            defaultValue={closes}
                          >
                            {timeOptions(closes).map((t) => (
                              <option key={t} value={t}>
                                {t === "23:59" ? "Midnight" : t}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </ObQ>
                    <ObQ
                      id="since"
                      group={false}
                      htmlFor="f-since"
                      title="Trading since"
                      optional
                      hint="Optional. Pick any date in the month you started."
                    >
                      <input
                        className="ob-input"
                        type="date"
                        id="f-since"
                        name="since"
                        min="1950-01-01"
                        max={today}
                        aria-describedby="q-since-h"
                        defaultValue={draft?.trading_since ?? ""}
                      />
                    </ObQ>
                    <ObQ
                      id="about"
                      group={false}
                      htmlFor="f-about"
                      title="Say what you do in one line"
                      hint="Tap a phrase to add it, or type your own. At least 10 characters."
                    >
                      <div
                        className="ob-picks"
                        role="group"
                        aria-label="Starter phrases"
                      >
                        {PHRASES.map((phrase) => (
                          <button
                            key={phrase}
                            type="button"
                            className="cx-chip"
                            aria-pressed={about.includes(phrase)}
                            onClick={() => {
                              const next = about.includes(phrase)
                                ? about
                                : `${about.trim()}${about.trim() ? " " : ""}${phrase}.`;
                              setAbout(next.slice(0, 2000));
                              aboutRef.current?.focus();
                            }}
                          >
                            + {phrase}
                          </button>
                        ))}
                      </div>
                      <textarea
                        ref={aboutRef}
                        className="ob-input"
                        id="f-about"
                        name="description"
                        minLength={10}
                        maxLength={2000}
                        rows={3}
                        required
                        placeholder="For example, Hand wash only. Same-day service."
                        aria-describedby="q-about-h"
                        value={about}
                        onChange={(event) => {
                          setAbout(event.target.value);
                        }}
                      />
                      <span className="ob-count" aria-live="polite">
                        {about.length} / 2000
                      </span>
                    </ObQ>
                  </>
                ) : null}
                {step === "check" ? (
                  <>
                    <dl className="ob-review">
                      {[
                        ["Business", draft?.business_name, "business"],
                        [
                          "Your role",
                          ROLES.find((r) => r.value === draft?.applicant_role)
                            ?.label,
                          "business",
                        ],
                        [
                          "Services",
                          draft?.service_slugs.map(serviceLabel).join(", "),
                          "service",
                        ],
                        [
                          "Customers",
                          mode === "both"
                            ? "They come to me, I go to them"
                            : mode === "mobile"
                              ? "I go to them"
                              : mode === "fixed"
                                ? "They come to me"
                                : "",
                          "service",
                        ],
                        ["Metro or area", draft?.metro, "location"],
                        [
                          "Location",
                          [
                            mode !== "mobile" && draft?.public_address
                              ? draft.public_address
                              : "",
                            mode !== "fixed" && draft?.radius_km
                              ? `Private base set · travels up to ${String(draft.radius_km)} km (never shown)`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · "),
                          "location",
                        ],
                        ["Hours", hoursText, "about"],
                        [
                          "Team size",
                          TEAM.find((t) => t.value === draft?.team_size_band)
                            ?.label,
                          "service",
                        ],
                        ["Trading since", draft?.trading_since ?? "", "about"],
                        ["About", draft?.description, "about"],
                      ].map(([label, value, to]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd className={value ? undefined : "empty"}>
                            {value || "Not answered"}
                          </dd>
                          <a className="ob-link" href={path(to as Step)}>
                            Change<span className="cx-vh"> {label}</span>
                          </a>
                        </div>
                      ))}
                    </dl>
                    <p className="ob-private">
                      <ObIcon name="eye" />
                      <span>
                        <b>What&apos;s public:</b> your name, services, hours,
                        about line and{" "}
                        {mode === "fixed"
                          ? "premises address"
                          : mode === "mobile"
                            ? "“Comes to you” with your metro"
                            : "premises address and “Comes to you” with your metro"}
                        .{" "}
                        {mode !== "fixed"
                          ? "Your base and radius stay private. "
                          : ""}
                        We never ask for ID numbers or your date of birth.
                      </span>
                    </p>
                    <div className="ob-q ob-q-adult">
                      <label className="ob-switch">
                        <span>
                          <span className="ob-qt">I&apos;m 18 or older</span>
                          <span
                            className="ob-qh"
                            style={{ display: "block", fontWeight: 400 }}
                          >
                            We don&apos;t ask for your date of birth or ID
                            number.
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          role="switch"
                          name="adult"
                          required
                        />
                        <span className="track" aria-hidden="true" />
                      </label>
                    </div>
                    <div className="ob-q ob-q-consent">
                      <div className="ob-consent">
                        <label className="cx-check">
                          <input type="checkbox" name="consent" required />
                          <span className="cx-box" aria-hidden="true" />
                          <span>
                            These details are true, and I may list this
                            business.
                          </span>
                        </label>
                        {mode !== "fixed" ? (
                          <label className="cx-check">
                            <input type="checkbox" name="probing" required />
                            <span className="cx-box" aria-hidden="true" />
                            <span>
                              I understand that repeated searches could let
                              someone estimate roughly where my mobile base is,
                              even though CarworX never shows its exact location
                              or travel radius.
                            </span>
                          </label>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : null}
                {step !== "location" ? actions : null}
              </Form>
              {step === "location" ? (
                <>
                  <PinPicker
                    csrf={csrf}
                    action={path("location")}
                    title={
                      mode === "mobile"
                        ? "Where do you start from?"
                        : "Drop a pin on your premises"
                    }
                    hint={
                      mode === "mobile"
                        ? "Search for an address, tap the map, or use your location. Used only to match you with nearby customers."
                        : "Search for your address, tap the map, or use your location. Customers see this on your listing."
                    }
                    privateBase={mode === "mobile"}
                    initial={
                      draft?.pin_lat !== null &&
                      draft?.pin_lat !== undefined &&
                      draft.pin_lng !== null &&
                      draft.pin_source
                        ? {
                            lat: draft.pin_lat,
                            lng: draft.pin_lng,
                            source: draft.pin_source,
                          }
                        : null
                    }
                    mapEnabled={loaderData.mapEnabled}
                  />
                  {mode !== "mobile" ? (
                    <ObQ
                      id="address"
                      group={false}
                      htmlFor="f-address"
                      title="Public premises address"
                      hint="Type this yourself. It appears on your listing; map search never fills it in."
                    >
                      <input
                        className="ob-input"
                        id="f-address"
                        form={formId}
                        name="address"
                        required
                        minLength={5}
                        maxLength={300}
                        autoComplete="street-address"
                        aria-describedby="q-address-h"
                        defaultValue={draft?.public_address ?? ""}
                      />
                    </ObQ>
                  ) : null}
                  {mode !== "fixed" ? (
                    <div className="ob-q ob-q-base">
                      <div className="ob-range">
                        <div className="row">
                          <label htmlFor="f-radius">
                            How far you&apos;ll travel
                          </label>
                          <output htmlFor="f-radius">{radius} km</output>
                        </div>
                        <input
                          type="range"
                          id="f-radius"
                          form={formId}
                          name="radiusKm"
                          min={5}
                          max={100}
                          step={5}
                          value={radius}
                          onChange={(event) => {
                            setRadius(Number(event.target.value));
                          }}
                        />
                      </div>
                      <p className="ob-private">
                        <ObIcon name="lock" />
                        <span>
                          <b>Private.</b> Customers never see your base or your
                          radius. Your listing only says you come to them, in
                          your metro.
                        </span>
                      </p>
                    </div>
                  ) : null}
                  {actions}
                </>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
