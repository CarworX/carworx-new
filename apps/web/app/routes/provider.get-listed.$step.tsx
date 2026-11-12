import { SERVICES } from "../ui/services";
import { useState } from "react";
import { data, Form, useNavigation } from "react-router";
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
import { inSouthAfrica } from "../onboarding/map";
import { PinPicker, type GeoReply } from "../onboarding/PinPicker";
import { SERVICE_OPTIONS } from "../server/providers/forms";
import {
  checkQuota,
  checkSearchLimits,
  type LimiterNamespace,
} from "../server/search/limiter";
import { Button, ButtonLink, QuietLink } from "../ui/Button";
import { ChoiceTiles, PickChips } from "../ui/Choice";
import { DAYS, DayToggles } from "../ui/DayToggles";
import { ConsentCheckbox, TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import { ResultCard } from "../ui/ResultCard";
import { SegmentedProgress } from "../ui/SegmentedProgress";
import { StarterPhrases } from "../ui/StarterPhrases";
import { StepRail, type RailStep } from "../ui/StepRail";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/provider.get-listed.$step";

const DRAFT_COLUMNS =
  "id, business_name, applicant_role, service_slugs, mode, metro, public_address, pin_lat, pin_lng, pin_source, radius_km, description, hours, team_size_band, trading_since, step";
const RAIL: readonly RailStep[] = [
  { title: "Business", body: "Name and your role", icon: "user" },
  { title: "Service", body: "What you offer and how", icon: "car" },
  { title: "Location", body: "Metro, pin and travel area", icon: "pin" },
  { title: "About", body: "Hours and a line about you", icon: "clock" },
  { title: "Check", body: "Review and send", icon: "check" },
];
interface MapEnv {
  MAPBOX_SERVER_TOKEN?: string;
  SEARCH_LIMITER?: LimiterNamespace;
  SEARCH_LIMITER_SALT?: string;
}
const path = (step: Step | "submitted") => `/provider/get-listed/${step}`;
const EMPTY_REPLY: GeoReply = { problem: null, candidates: null, map: null };
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
  if (step === "submitted") {
    const submitted = await signedIn.supabase
      .from("provider_applications")
      .select("submitted_listing_public_id")
      .eq("user_id", signedIn.user.id)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .overrideTypes<
        { submitted_listing_public_id: string }[],
        { merge: false }
      >();
    if (submitted.error) throwStatus(503, signedIn.headers);
    listingId = submitted.data[0]?.submitted_listing_public_id ?? null;
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
  return throwRedirect(path(next ?? "check"), signedIn.headers);
}

export default function GetListed(props: Route.ComponentProps) {
  return <Application key={props.loaderData.step} {...props} />;
}

function Application({ loaderData, actionData }: Route.ComponentProps) {
  const { draft, step, csrf } = loaderData;
  const navigation = useNavigation();
  const [previewName, setPreviewName] = useState(
    draft?.business_name ?? "Your business name",
  );
  const [previewServices, setPreviewServices] = useState(
    draft?.service_slugs ?? [],
  );
  const [previewMetro, setPreviewMetro] = useState(draft?.metro ?? "Your area");
  if (step === "submitted")
    return (
      <PublicShell signedIn>
        <h1 className="type-display-lg">
          {loaderData.status === "live"
            ? "You're live"
            : loaderData.status === "draft"
              ? "Your application needs a change"
              : loaderData.status === "suspended"
                ? "Your listing is paused"
                : "Application sent"}
        </h1>
        <p className="type-body mt-4 max-w-[65ch]">
          {loaderData.status === "live"
            ? "Customers can find your listing. Finish setup to get your team ready."
            : "Open your business dashboard to see its current review status and any feedback. Only an approved listing appears in search."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/provider">
            {loaderData.status === "live"
              ? "Finish setup"
              : "Open business dashboard"}
          </ButtonLink>
          {loaderData.status === "live" && loaderData.listingId ? (
            <ButtonLink variant="secondary" href={`/p/${loaderData.listingId}`}>
              View listing
            </ButtonLink>
          ) : null}
        </div>
      </PublicShell>
    );
  const current = (STEPS as readonly string[]).indexOf(step);
  const title = RAIL[current]?.title ?? "Business";
  const previous = STEPS[current - 1];
  const work =
    draft?.mode === "both"
      ? ["fixed", "mobile"]
      : draft?.mode
        ? [draft.mode]
        : [];
  return (
    <PublicShell signedIn>
      <h1 className="type-display-lg">Get approved</h1>
      <p className="type-body mt-3">
        Five short steps. Your answers are saved after each step.
      </p>
      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <StepRail steps={RAIL} current={current} label="Application steps" />
        </aside>
        <div className="grid gap-6">
          <SegmentedProgress
            step={current}
            total={STEPS.length}
            name={title}
            label="Application progress"
          />
          {actionData?.problem ? (
            <StatusNote tone="err" title="We couldn't continue.">
              {actionData.problem}
            </StatusNote>
          ) : null}
          <section className="grid gap-5 rounded-2xl bg-white p-5 sm:p-8">
            <h2 className="type-display-md">{title}</h2>
            {step === "location" ? (
              <PinPicker
                csrf={csrf}
                action={path("location")}
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
            ) : null}
            <Form
              id="application-step"
              method="post"
              className="grid gap-5"
              onChange={(event) => {
                const answers = new FormData(event.currentTarget);
                const name = answers.get("businessName");
                if (typeof name === "string")
                  setPreviewName(name || "Your business name");
                if (step === "service")
                  setPreviewServices(
                    answers
                      .getAll("services")
                      .filter(
                        (value): value is string => typeof value === "string",
                      ),
                  );
                const metro = answers.get("metro");
                if (typeof metro === "string")
                  setPreviewMetro(metro || "Your area");
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
                  <TextField
                    label="Business name"
                    name="businessName"
                    minLength={2}
                    maxLength={160}
                    required
                    defaultValue={draft?.business_name ?? ""}
                  />
                  <ChoiceTiles
                    legend="Your role at the business"
                    name="role"
                    required
                    defaultValue={draft?.applicant_role ?? "owner"}
                    options={[
                      { value: "owner", title: "Owner" },
                      { value: "manager", title: "Manager" },
                      { value: "other", title: "I help run it" },
                    ]}
                  />
                  <p className="type-caption">
                    You must be authorised to list the business. Your role helps
                    our review; you become its CarworX account owner if
                    approved.
                  </p>
                </>
              ) : null}
              {step === "service" ? (
                <>
                  <PickChips
                    legend="What do you offer?"
                    hint="Pick all that apply. The first service is your main service."
                    name="services"
                    multiple
                    defaultValue={draft?.service_slugs ?? []}
                    options={SERVICE_OPTIONS.map((s) => ({
                      value: s.slug,
                      label: s.label,
                    }))}
                  />
                  <ChoiceTiles
                    legend="Where do you serve customers?"
                    hint="Pick one or both."
                    name="work"
                    multiple
                    defaultValue={work}
                    options={[
                      {
                        value: "fixed",
                        title: "They come to me",
                        description: "Customers visit my premises",
                        icon: "home",
                      },
                      {
                        value: "mobile",
                        title: "I go to them",
                        description: "I travel to customers",
                        icon: "car",
                      },
                    ]}
                  />
                  <PickChips
                    legend="How many people are in your team?"
                    name="team"
                    required
                    defaultValue={draft?.team_size_band ?? "solo"}
                    options={[
                      { value: "solo", label: "Just me" },
                      { value: "2-5", label: "2–5" },
                      { value: "6-15", label: "6–15" },
                      { value: "16+", label: "16+" },
                    ]}
                  />
                </>
              ) : null}
              {step === "location" ? (
                <>
                  <input type="hidden" name="mode" value={draft?.mode ?? ""} />
                  <label className="cx-field">
                    <span className="lbl">Area or metro</span>
                    <select
                      className="cx-input"
                      name="metro"
                      required
                      defaultValue={draft?.metro ?? ""}
                    >
                      <option value="" disabled>
                        Choose your area
                      </option>
                      {METROS.map((metro) => (
                        <option key={metro}>{metro}</option>
                      ))}
                    </select>
                  </label>
                  {draft?.mode !== "mobile" ? (
                    <TextField
                      label="Public premises address"
                      name="address"
                      required
                      minLength={5}
                      maxLength={300}
                      defaultValue={draft?.public_address ?? ""}
                      hint="Type this yourself. It will appear publicly; map search never fills it in."
                    />
                  ) : null}
                  {draft?.mode !== "fixed" ? (
                    <label className="cx-field">
                      <span className="lbl">How far do you travel?</span>
                      <select
                        className="cx-input"
                        name="radiusKm"
                        defaultValue={draft?.radius_km ?? 25}
                      >
                        {[5, 10, 15, 20, 25, 30, 40, 50, 75, 100].map((km) => (
                          <option key={km} value={km}>
                            {km} km
                          </option>
                        ))}
                      </select>
                      <span className="hint">
                        Your exact base and travel radius stay private.
                      </span>
                    </label>
                  ) : null}
                </>
              ) : null}
              {step === "about" ? (
                <>
                  <DayToggles
                    legend="Which days are you open?"
                    defaultDays={
                      draft?.hours.length
                        ? draft.hours.flatMap((hour) => {
                            const day = DAYS[hour.day - 1];
                            return day ? [day] : [];
                          })
                        : undefined
                    }
                    defaultOpen={draft?.hours[0]?.opens ?? "08:00"}
                    defaultClose={draft?.hours[0]?.closes ?? "17:00"}
                  />
                  <StarterPhrases
                    label="A line about your business"
                    name="description"
                    maxLength={2000}
                    defaultValue={draft?.description ?? ""}
                    phrases={[
                      "Friendly local service",
                      "Experienced with all makes",
                      "We come to you",
                      "Care and attention to detail",
                    ]}
                    hint="Pick a starter phrase or write your own. At least 10 characters."
                  />
                </>
              ) : null}
              {step === "check" ? (
                <>
                  <dl className="grid gap-3">
                    <div>
                      <dt>Business</dt>
                      <dd>
                        {draft?.business_name} · {draft?.applicant_role}{" "}
                        <QuietLink href={path("business")}>
                          Change business
                        </QuietLink>
                      </dd>
                    </div>
                    <div>
                      <dt>Services</dt>
                      <dd>
                        {draft?.service_slugs
                          .map(
                            (slug) =>
                              SERVICE_OPTIONS.find((s) => s.slug === slug)
                                ?.label ?? slug,
                          )
                          .join(", ")}{" "}
                        · {draft?.mode}{" "}
                        <QuietLink href={path("service")}>
                          Change service
                        </QuietLink>
                      </dd>
                    </div>
                    <div>
                      <dt>Location</dt>
                      <dd>
                        {draft?.metro}
                        {draft?.public_address
                          ? ` · ${draft.public_address}`
                          : " · private mobile base"}{" "}
                        <QuietLink href={path("location")}>
                          Change location
                        </QuietLink>
                      </dd>
                    </div>
                    <div>
                      <dt>About</dt>
                      <dd>
                        {draft?.description}{" "}
                        <QuietLink href={path("about")}>Change about</QuietLink>
                      </dd>
                    </div>
                  </dl>
                  <ConsentCheckbox name="adult" required>
                    I am 18 or older and authorised to list this business.
                  </ConsentCheckbox>
                  {draft?.mode !== "fixed" ? (
                    <ConsentCheckbox name="probing" required>
                      I understand that repeated searches could let someone
                      estimate roughly where my mobile base is, even though
                      CarworX never shows its exact location or travel radius.
                    </ConsentCheckbox>
                  ) : null}
                  <p className="type-caption">
                    An admin reviews your application before your listing
                    appears. This does not book a service or charge anything.
                  </p>
                </>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                {previous ? (
                  <QuietLink href={path(previous)}>Back</QuietLink>
                ) : (
                  <QuietLink href="/provider">Save and leave</QuietLink>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  busy={navigation.state !== "idle"}
                >
                  {step === "check" ? "Send for review" : "Save and continue"}
                </Button>
              </div>
            </Form>
          </section>
          <aside aria-label="Your listing preview" className="grid gap-3">
            <h2 className="type-body font-medium">Your listing preview</h2>
            <ResultCard
              name={previewName}
              href="#application-step"
              meta={`${previewMetro} · ${previewServices.map((slug) => SERVICE_OPTIONS.find((s) => s.slug === slug)?.label ?? slug).join(", ") || "Your services"}`}
              price="Prices added later"
              thumb={SERVICES[1]?.object ?? ""}
            />
            <p className="type-caption">
              Preview only. Your listing is published after approval. Your
              mobile base is never displayed.
            </p>
          </aside>
          <QuietLink href="/provider">Leave and return later</QuietLink>
        </div>
      </div>
    </PublicShell>
  );
}
