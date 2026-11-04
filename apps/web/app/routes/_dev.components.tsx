// /_dev/components: the living Studio page. Every component and state,
// built from the generated tokens, with synthetic copy only (no personal
// data, nothing loaded at runtime). Guarded by _dev.guard.ts.
import { useEffect, useState, type ReactNode } from "react";

import tokens from "../../../../planning/design/brand/tokens.json";
import { BookingTile, Receipt, StickyNote } from "../ui/Booking";
import { Button, ButtonLink, QuietLink, TextLink } from "../ui/Button";
import {
  ActorChip,
  Demo,
  FilterChip,
  StatusLabel,
  TimeSlots,
} from "../ui/Chip";
import { measure, type RGBA, parseColor, ratio } from "../ui/contrast";
import { PAIRS } from "../ui/contrast-pairs";
import {
  ConsentCheckbox,
  SearchField,
  Segmented,
  TextField,
} from "../ui/Field";
import { HoldDial } from "../ui/HoldDial";
import { Icon } from "../ui/Icon";
import { ICON_NAMES } from "../ui/icons.generated";
import { KpiCard, PeriodTabs } from "../ui/Kpi";
import { usePrefersReducedMotion } from "../ui/motion";
import { NavBar } from "../ui/NavBar";
import { EmptyState, StatusNote } from "../ui/Note";
import { ResultCard } from "../ui/ResultCard";
import { ServiceKeyRows, ServiceKeys } from "../ui/ServiceKeys";
import { SERVICES } from "../ui/services";
import { NotFound } from "../ui/states/NotFound";
import { PageLoader, RipplePatch } from "../ui/states/PageLoader";
import {
  SkeletonCard,
  SkeletonGroup,
  SkeletonRow,
} from "../ui/states/Skeleton";
import { StepDial } from "../ui/states/StepDial";
import { StepList } from "../ui/StepList";
import type { Route } from "./+types/_dev.components";
import { DEV_HEADERS, devPagesEnabled } from "./_dev.guard";

export function loader({ request, context }: Route.LoaderArgs) {
  if (!devPagesEnabled(request, context.cloudflare.env)) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router's documented way to send a status
    throw new Response("Not Found", { status: 404 });
  }
  return null;
}

export const headers: Route.HeadersFunction = () => DEV_HEADERS;

export const meta: Route.MetaFunction = () => [
  { title: "Studio components · CarworX (dev)" },
  { name: "robots", content: "noindex, nofollow" },
];

const COLORS = Object.fromEntries(
  tokens.color.tokens.map((t) => [t.name, t.value]),
);
const CANVAS: RGBA = parseColor(COLORS["canvas"] ?? "#f2f1ee");
const HREFS = Object.fromEntries(
  SERVICES.map((s) => [s.key, `#svc-${s.key}`]),
) as Record<(typeof SERVICES)[number]["key"], string>;
const STEPS = [
  "Finding businesses near Ferndale…",
  "Checking who’s open Saturday…",
  "Sorting by straight-line distance…",
  "Loading listed prices…",
];
const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#services", label: "Services" },
  { href: "#business", label: "For businesses" },
  { href: "#help", label: "Help" },
];

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mt-16 scroll-mt-6">
      <p className="cx-eyebrow">{eyebrow}</p>
      <h2 id={`${id}-h`} className="type-title mt-2">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg bg-surface p-6 shadow-1 ${className}`}>
      <h3 className="type-label text-muted">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** The step-dial loader, stepping through honest status lines. */
function StepDialDemo({
  still,
  size,
  compact,
}: {
  still: boolean;
  size?: number;
  compact?: boolean;
}) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (still) return;
    const start = performance.now();
    const id = window.setInterval(() => {
      setT((performance.now() - start) / 1000);
    }, 100);
    return () => {
      window.clearInterval(id);
    };
  }, [still]);
  const per = 2.3;
  const cycle = per * STEPS.length + 1.8;
  const tt = still ? per * 1.4 : t % cycle;
  const step = Math.min(STEPS.length, Math.floor(tt / per));
  const u = (tt - step * per) / per;
  const progress = still ? 0.43 : 1 - Math.exp(-3 * u);
  return (
    <StepDial
      steps={STEPS}
      step={step}
      progress={progress}
      {...(size ? { size } : {})}
      {...(compact ? { compact } : {})}
    />
  );
}

function Pair({ motion, still }: { motion: ReactNode; still: ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="type-caption mb-2 text-muted">Motion</p>
        {motion}
      </div>
      <div>
        <p className="type-caption mb-2 text-muted">Reduced-motion still</p>
        <div data-motion="still">{still}</div>
      </div>
    </div>
  );
}

export default function DevComponents() {
  const systemReduced = usePrefersReducedMotion();
  const [forceStill, setForceStill] = useState(false);
  const still = systemReduced || forceStill;
  const measured = measure(PAIRS, COLORS);
  const passed = measured.filter((m) => m.pass).length;

  return (
    <div
      className="cx-canvas min-h-dvh"
      data-motion={forceStill ? "still" : undefined}
    >
      <div className="mx-auto max-w-[1180px] px-4 pt-4 pb-24 sm:px-6">
        <NavBar
          items={NAV}
          current="#services"
          homeHref="#top"
          action={
            <ButtonLink href="#business" variant="secondary" size="sm">
              List your business
            </ButtonLink>
          }
          sheetActions={
            <>
              <ButtonLink href="#services" block arrow>
                Find a service near you
              </ButtonLink>
              <ButtonLink href="#business" variant="secondary" block>
                List your business
              </ButtonLink>
            </>
          }
        />

        <main id="top" className="mt-12">
          <p className="cx-eyebrow">
            Studio · living component page · dev only
          </p>
          <h1 className="type-display-lg mt-3 max-sm:text-[34px] max-sm:leading-[36px]">
            Studio in code.
            <span className="block text-quiet">
              Every component, every state.
            </span>
          </h1>
          <p className="type-lede mt-4 max-w-[40em] text-muted">
            Built from{" "}
            <code className="font-mono text-[0.9em]">tokens.json</code> v4 by
            the token generator. All names, places and prices are fictional.
            This page is not indexed and is not served in production.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              aria-pressed={forceStill}
              onClick={() => {
                setForceStill(!forceStill);
              }}
            >
              {forceStill ? "Show motion" : "Show reduced-motion stills"}
            </Button>
            <span className="type-caption text-muted">
              System setting:{" "}
              {systemReduced ? "reduced motion" : "motion allowed"}
            </span>
          </div>

          <Section id="tokens" eyebrow="Foundations" title="Colour tokens">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {tokens.color.tokens.map((t) => (
                <li key={t.name} className="rounded-md bg-surface p-3 shadow-1">
                  <span
                    className="block h-12 rounded-sm"
                    style={{
                      background: `var(--${t.name})`,
                      boxShadow: "inset 0 0 0 1px var(--hair)",
                    }}
                  />
                  <span className="type-label mt-2 block">{t.name}</span>
                  <span className="type-price block text-muted [overflow-wrap:anywhere]">
                    {t.value}
                  </span>
                  <span className="type-caption block text-muted">
                    {ratio(parseColor(t.value), CANVAS).toFixed(2)}:1 on canvas
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="type"
            eyebrow="Foundations"
            title="Type, radii and shadows"
          >
            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <Panel title="Type styles (type-* utilities)">
                <div className="grid gap-3">
                  {tokens.type.groups.flatMap((g) =>
                    g.styles.map((s) => (
                      <div
                        key={s.name}
                        className="flex flex-wrap items-baseline gap-x-4 gap-y-1"
                      >
                        <span className="type-eyebrow w-24 shrink-0 text-muted">
                          {s.name}
                        </span>
                        <span
                          className={`type-${s.name} min-w-0`}
                          style={{ overflowWrap: "anywhere" }}
                        >
                          {s.sample}
                        </span>
                      </div>
                    )),
                  )}
                </div>
              </Panel>
              <div className="grid gap-4">
                <Panel title="Radii">
                  <div className="flex flex-wrap gap-3">
                    {tokens.radius.tokens.map((r) => (
                      <span
                        key={r.name}
                        className="grid h-16 w-16 place-items-center bg-canvas-2 type-caption"
                        style={{ borderRadius: `var(--${r.name})` }}
                      >
                        {r.name.replace("radius-", "")}
                      </span>
                    ))}
                  </div>
                </Panel>
                <Panel title="Shadows">
                  <div className="flex flex-wrap gap-4">
                    {tokens.shadow.tokens.map((s) => (
                      <span
                        key={s.name}
                        className="grid h-16 w-20 place-items-center rounded-md bg-surface type-caption"
                        style={{ boxShadow: `var(--${s.name})` }}
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          </Section>

          <Section id="icons" eyebrow="Iconography" title="UI glyphs">
            <ul className="flex flex-wrap gap-2">
              {ICON_NAMES.map((n) => (
                <li
                  key={n}
                  className="grid w-20 justify-items-center gap-1 rounded-md bg-surface p-3 shadow-1"
                >
                  <Icon name={n} size="lg" />
                  <span className="type-caption text-muted">{n}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="buttons" eyebrow="Actions" title="Buttons and links">
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink href="#services" arrow>
                Find a service near you
              </ButtonLink>
              <Button variant="primary">Request a time</Button>
              <Button variant="secondary">Ask a question</Button>
              <Button variant="outline">Not now</Button>
              <Button variant="primary" size="sm">
                Approve and pay
              </Button>
              <Button variant="outline" size="sm">
                Decline
              </Button>
              <Button variant="primary" disabled>
                Pay R330 securely
              </Button>
              <QuietLink href="#business">List your business free</QuietLink>
              <TextLink href="#help">Find a service</TextLink>
            </div>
            <div className="mt-4 max-w-sm">
              <Button variant="primary" block>
                Request a time
              </Button>
            </div>
          </Section>

          <Section
            id="chips"
            eyebrow="Choices"
            title="Chips, labels, slots and actors"
          >
            <div className="grid gap-6">
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Filters"
              >
                <FilterChip defaultPressed>Open Saturday</FilterChip>
                <FilterChip>Within 10 km</FilterChip>
                <FilterChip>Mobile service</FilterChip>
                <FilterChip>Listed prices</FilterChip>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusLabel>Paid</StatusLabel>
                <StatusLabel tone="info">Quote v2</StatusLabel>
                <StatusLabel tone="warn">Expires 11:40</StatusLabel>
                <StatusLabel tone="err">Payment failed</StatusLabel>
                <Demo />
              </div>
              <TimeSlots
                legend="Saturday times"
                options={[
                  { time: "08:00", taken: true },
                  { time: "09:00" },
                  { time: "10:30" },
                  { time: "12:00" },
                  { time: "14:30", taken: true },
                ]}
              />
              <div className="flex flex-wrap gap-2">
                <ActorChip actor="driver" />
                <ActorChip actor="business" />
                <ActorChip actor="carworx" />
              </div>
            </div>
          </Section>

          <Section
            id="fields"
            eyebrow="Forms"
            title="Fields, segmented control and consent"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Inputs">
                <div className="grid gap-4">
                  <SearchField
                    label="Search services"
                    placeholder="Wash, tyres, windscreen…"
                  />
                  <TextField
                    label="Your base"
                    hint="Kept private. Used only to sort by distance."
                    placeholder="Suburb or street"
                  />
                  <TextField
                    label="Mobile number"
                    type="tel"
                    defaultValue="082 000 000"
                    error="Check the number: it needs 10 digits."
                  />
                  <TextField
                    label="Business name"
                    disabled
                    defaultValue="Shine Studio"
                  />
                </div>
              </Panel>
              <Panel title="Choices and consent (unticked by default, G8)">
                <div className="grid gap-5">
                  <Segmented
                    legend="Show results as"
                    defaultValue="list"
                    options={[
                      { value: "list", label: "List" },
                      { value: "map", label: "Map" },
                    ]}
                  />
                  <ConsentCheckbox name="terms" required>
                    I agree to the booking terms. CarworX shares my name and
                    number with the business I book, only for this booking.
                  </ConsentCheckbox>
                  <ConsentCheckbox name="updates">
                    Send me service reminders by email. I can stop them at any
                    time.
                  </ConsentCheckbox>
                </div>
              </Panel>
            </div>
          </Section>

          <Section id="services" eyebrow="Front door" title="Service keys">
            <ServiceKeys
              hrefs={HREFS}
              hints={{ wash: "From R120", tyres: "Same day" }}
            />
            <div className="mt-6 max-w-sm">
              <ServiceKeyRows hrefs={HREFS} />
            </div>
          </Section>

          <Section
            id="notes"
            eyebrow="Feedback"
            title="Status notes and empty state"
          >
            <div className="grid gap-3 lg:grid-cols-2">
              <StatusNote title="CarworX is new.">
                Some areas have only a few businesses listed so far.
              </StatusNote>
              <StatusNote tone="ok" title="Paid.">
                Gleamline has your booking for Saturday 09:00.
              </StatusNote>
              <StatusNote tone="warn" title="Waiting for Gleamline.">
                They have until 11:40 to reply. You haven&apos;t paid anything.
              </StatusNote>
              <StatusNote tone="err" title="The payment didn't go through.">
                Nothing was taken. Your slot is still held for 09:12.
              </StatusNote>
              <EmptyState
                title="No businesses match yet"
                action={
                  <Button variant="outline" size="sm">
                    Clear filters
                  </Button>
                }
              >
                Try a wider distance, or turn off &ldquo;Open Saturday&rdquo;.
              </EmptyState>
            </div>
          </Section>

          <Section
            id="booking"
            eyebrow="Booking objects"
            title="Note, tile, hold dial and receipt"
          >
            <div className="grid items-start gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <StickyNote
                lines={["Sat 9:00 wash, Ferndale", "Bring the spare key"]}
              />
              <BookingTile
                title="Booking confirmed"
                subtitle="Gleamline · Saturday 09:00"
                meta={["Ref CX-2048", "R330"]}
              />
              <div className="grid justify-items-center gap-4">
                <HoldDial secondsLeft={872} />
                <p className="type-caption max-w-[22em] text-center text-muted">
                  If time runs out, the slot is released. If a payment arrives
                  afterwards, we&apos;ll help you rebook or get a refund.
                </p>
                <HoldDial
                  secondsLeft={0}
                  paid
                  size={140}
                  caption="Slot is yours"
                />
              </div>
              <Receipt
                title="QUOTE · CX-2048"
                lines={[
                  { label: "Full valet (v1)", amount: "R450", old: true },
                  { label: "Full valet (v2)", amount: "R380" },
                  { label: "Engine bay", amount: "R120" },
                ]}
                total={{ label: "Total", amount: "R500" }}
                stamp="VERSION 2"
              />
            </div>
          </Section>

          <Section
            id="results"
            eyebrow="Lists"
            title="Result card, steps and dashboard"
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="grid content-start gap-3">
                <ResultCard
                  name="Shine Studio"
                  href="#results"
                  meta="Rosebank · 2.4 km straight-line"
                  thumb={SERVICES[0]?.object ?? ""}
                  price="R120"
                  priceNote="from"
                  demo
                  labels={
                    <>
                      <StatusLabel>Prices listed</StatusLabel>
                      <StatusLabel tone="info">Open Saturday</StatusLabel>
                    </>
                  }
                />
                <ResultCard
                  name="Gleamline"
                  href="#results"
                  meta="Ferndale · 3.1 km straight-line"
                  thumb={SERVICES[0]?.object ?? ""}
                  price="R150"
                  priceNote="from"
                  demo
                />
              </div>
              <StepList
                active={1}
                steps={[
                  {
                    actor: "driver",
                    icon: "search",
                    title: "You ask for a time",
                    body: "Pick a service and a slot. Nothing is paid yet.",
                  },
                  {
                    actor: "business",
                    icon: "clock",
                    title: "The business accepts",
                    body: "They have two business hours to reply.",
                  },
                  {
                    actor: "carworx",
                    icon: "lock",
                    title: "You pay securely",
                    body: "The slot is held for 15 minutes while you pay.",
                  },
                ]}
              />
            </div>
            <div className="mt-6 grid gap-4">
              <PeriodTabs
                label="Period"
                options={["7 days", "30 days", "Year"]}
              />
              <div className="cx-kpis">
                <KpiCard
                  label="Bookings"
                  value="48"
                  foot="Demo numbers"
                  fill={0.62}
                />
                <KpiCard
                  label="Paid out"
                  prefix="R"
                  value="3 960"
                  foot="Demo numbers"
                  fill={0.4}
                />
                <KpiCard label="Reply time" value="38m" foot="Median" />
                <KpiCard
                  label="CarworX fee"
                  prefix="R"
                  value="0"
                  foot="Free pilot"
                  fee
                />
              </div>
            </div>
          </Section>

          <Section
            id="loaders"
            eyebrow="System states · D-041"
            title="Loaders, each with its reduced-motion still"
          >
            <div className="grid gap-4">
              <Panel title="In a button · hold dial, the spinning arc">
                <Pair
                  motion={
                    <div className="flex flex-wrap gap-3">
                      <Button variant="primary" busy>
                        Sending request
                      </Button>
                      <Button variant="secondary" busy>
                        Loading more results
                      </Button>
                    </div>
                  }
                  still={
                    <div className="flex flex-wrap gap-3">
                      <Button variant="primary" busy>
                        Sending request
                      </Button>
                      <Button variant="secondary" busy>
                        Loading more results
                      </Button>
                    </div>
                  }
                />
              </Panel>
              <Panel title="In a page, a wait the user is watching · hold dial, the ring and its status line">
                <Pair
                  motion={
                    still ? (
                      <StepDialDemo still />
                    ) : (
                      <StepDialDemo still={false} />
                    )
                  }
                  still={<StepDialDemo still />}
                />
              </Panel>
              <Panel title="In a page, layout known · skeleton cards and the shimmer">
                <Pair
                  motion={
                    <SkeletonGroup label="Loading results">
                      <SkeletonCard i={0} />
                      <SkeletonCard i={1} />
                    </SkeletonGroup>
                  }
                  still={
                    <SkeletonGroup label="Loading results">
                      <SkeletonCard i={0} />
                      <SkeletonCard i={1} />
                    </SkeletonGroup>
                  }
                />
              </Panel>
              <Panel title="On a card or list · the skeleton row">
                <Pair
                  motion={
                    <SkeletonGroup label="Loading one more business">
                      <SkeletonRow />
                    </SkeletonGroup>
                  }
                  still={
                    <SkeletonGroup label="Loading one more business">
                      <SkeletonRow />
                    </SkeletonGroup>
                  }
                />
              </Panel>
              <Panel title="Between pages · the dot-grid ripple">
                <Pair
                  motion={
                    <div
                      className="h-[300px] overflow-hidden rounded-md"
                      style={{ boxShadow: "inset 0 0 0 1px var(--hair)" }}
                    >
                      <PageLoader fullScreen={false} still={still} />
                    </div>
                  }
                  still={
                    <div
                      className="h-[300px] overflow-hidden rounded-md"
                      style={{ boxShadow: "inset 0 0 0 1px var(--hair)" }}
                    >
                      <PageLoader fullScreen={false} still />
                    </div>
                  }
                />
                <div className="mt-4 flex items-center gap-3">
                  <span className="type-caption text-muted">
                    In a button, the 5 × 5 patch with no rotor:
                  </span>
                  <RipplePatch still={still} />
                  <RipplePatch dark still={still} />
                </div>
              </Panel>
            </div>
          </Section>

          <Section
            id="not-found"
            eyebrow="System states · D-041"
            title="The 404 · dot-grid lens"
          >
            <p className="type-body-sm mb-4 max-w-[46em] text-muted">
              Move the pointer over the grid; click or tap for a pulse. The real
              404 is any unknown path, full screen, with status 404.
            </p>
            <div className="grid gap-6">
              <div className="h-[900px] overflow-hidden rounded-xl shadow-3 max-sm:h-[844px]">
                <NotFound
                  embedded
                  still={still}
                  homeHref="#top"
                  findHref="#services"
                  serviceHref={(k) => `#svc-${k}`}
                />
              </div>
              <div>
                <p className="type-caption mb-2 text-muted">
                  Reduced-motion still: the loupe rests over the rotor and
                  nothing moves.
                </p>
                <div
                  data-motion="still"
                  className="h-[900px] overflow-hidden rounded-xl shadow-3 max-sm:h-[844px]"
                >
                  <NotFound
                    embedded
                    still
                    homeHref="#top"
                    findHref="#services"
                    serviceHref={(k) => `#svc-${k}`}
                  />
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="contrast"
            eyebrow="Checks · G15"
            title="Contrast, measured"
          >
            <p className="type-body-sm text-muted">
              {passed} of {measured.length} registered pairs meet their floor
              (text 4.5:1, large text and UI 3:1). The same numbers come from{" "}
              <code className="font-mono">
                pnpm --filter @carworx/web contrast
              </code>{" "}
              and the unit tests.
            </p>
            <div className="mt-4 overflow-x-auto rounded-lg bg-surface shadow-1">
              <table className="w-full text-left type-body-sm">
                <thead>
                  <tr className="type-eyebrow text-muted">
                    <th className="p-3">Where</th>
                    <th className="p-3">Colours</th>
                    <th className="p-3">Ratio</th>
                    <th className="p-3">Floor</th>
                  </tr>
                </thead>
                <tbody>
                  {measured.map((m) => (
                    <tr key={m.where} className="border-t border-hair">
                      <td className="p-3">{m.where}</td>
                      <td className="p-3 font-mono text-[13px]">
                        {m.fg} on {m.via ? `${m.via} over ` : ""}
                        {m.bg}
                      </td>
                      <td className="p-3 font-mono">{m.ratio.toFixed(2)}:1</td>
                      <td className="p-3">
                        {m.pass ? (
                          <StatusLabel>{`≥ ${m.floor.toFixed(1)}`}</StatusLabel>
                        ) : (
                          <StatusLabel tone="err">{`< ${m.floor.toFixed(1)}`}</StatusLabel>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
}
