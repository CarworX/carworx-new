import { Mark } from "../ui/brand/Lockup";
import { ButtonLink, TextLink } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { PublicShell } from "../ui/public/PublicShell";
import { SearchForm } from "../ui/public/SearchForm";
import { ServiceKeys } from "../ui/ServiceKeys";
import { SERVICE_HREFS } from "../catalogue/taxonomy";
import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => [
  { title: "CarworX · Find trusted car services near you" },
  {
    name: "description",
    content:
      "Find car washes, mechanics, glass repair and tyre services near you in South Africa. Free to search.",
  },
];

/** Public, no personal data: may be cached briefly by browsers. */
export const headers: Route.HeadersFunction = () => ({
  "Cache-Control": "public, max-age=300",
});

const GET_LISTED = "/provider/get-listed/business";

/**
 * Desk objects around the hero, as in the approved preview. They show what
 * the directory really does today (hours, checks), not bookings, which are
 * the second release (D-093).
 */
function Floats() {
  return (
    <div className="cx-floats" aria-hidden="true">
      <div className="note">
        <p>Sat 9:00 wash, Rosebank</p>
        <p>ask about the tyres too</p>
      </div>
      <div className="tile t1">
        <div className="row">
          <span className="tick ok">
            <Icon name="clock" />
          </span>
          <div>
            <b>Open now</b>
            <small>Closes 17:00 · SAST</small>
          </div>
        </div>
        <div className="meta">
          <span>Mon to Sat</span>
          <span>Set by the business</span>
        </div>
      </div>
      <div className="tile t2">
        <div className="row">
          <span className="tick">
            <Icon name="shield" />
          </span>
          <div>
            <b>Identity checked</b>
            <small>Every label says what we checked</small>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    title: "Search your area",
    body: "Type a suburb or use your location. Workshops you can visit and mobile teams who come to you, side by side.",
  },
  {
    title: "Compare what was checked",
    body: "Each listing shows its opening hours, where it works and exactly which checks CarworX has done. Nothing is implied.",
  },
  {
    title: "Contact the business directly",
    body: "Send a short enquiry from the listing. The business replies to you; CarworX never sells your details.",
  },
] as const;

export default function Home() {
  return (
    <PublicShell current="/" wide>
      <section className="cx-hero" aria-labelledby="h-hero">
        <Floats />
        <div className="copy">
          <span className="cx-badge">
            <i />
            Free to search · no account needed
          </span>
          <h1 id="h-hero">
            <span className="ln">Find trusted car services.</span>
            <span className="ln grey">Nearby, and in writing.</span>
          </h1>
          <p className="sub">
            Washes, repairs, glass and tyres from businesses near you, plus
            straight answers on fines and vehicle admin. Every label says
            exactly what we checked.
          </p>
        </div>
        <div className="find" id="find">
          <SearchForm />
        </div>
        <div className="keys">
          <h2 className="cx-vh">Browse by service</h2>
          <ServiceKeys hrefs={SERVICE_HREFS} />
        </div>
      </section>

      <section className="cx-sec" id="how" aria-labelledby="h-how">
        <span className="cx-eyebrow">How it works</span>
        <h2 className="cx-h2" id="h-how">
          <span className="ln">Find it, check it, ask.</span>
          <span className="ln grey">
            Nothing hidden, everything in writing.
          </span>
        </h2>
        <ol className="cx-how-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="k">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="cx-sec" id="fines" aria-labelledby="h-fines">
        <div className="cx-fines">
          <div className="ill">
            <img
              src="/illustrations/fines-car.svg"
              alt=""
              width={390}
              height={270}
            />
          </div>
          <div>
            <span className="cx-eyebrow">Fines &amp; Vehicle Admin</span>
            <h2 className="cx-h2" id="h-fines">
              <span className="ln">A fine on the windscreen?</span>
              <span className="ln grey">Straight answers, in plain words.</span>
            </h2>
            <p className="cx-lede">
              Find out what a notice means, what your options are and what to do
              next. Licence renewals and vehicle admin, explained without the
              runaround.
            </p>
            <ul className="cx-qs">
              <li>What does this notice mean?</li>
              <li>What happens if I ignore it?</li>
              <li>How do I renew my licence disc?</li>
            </ul>
            <div className="cx-cta-row">
              <ButtonLink href="/fines" variant="secondary" arrow>
                Read the fines guide
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="cx-sec" id="business" aria-labelledby="h-biz">
        <span className="cx-eyebrow">For businesses</span>
        <div className="cx-biz">
          <div>
            <h2 className="cx-h2" id="h-biz">
              <span className="ln">List free during the pilot.</span>
              <span className="ln grey">Customers contact you directly.</span>
            </h2>
            <p className="cx-lede">
              Washes, workshops, glass fitters, tyre shops and mobile teams.
              Tell us what you do and where; we check it, and your listing goes
              live with the labels you have earned.
            </p>
          </div>
          <div className="chips" aria-label="What you get">
            <span>CarworX fee: R0 in the pilot</span>
            <span>Your own opening hours</span>
            <span>Reviewed before it goes live</span>
            <span>Invite your team</span>
          </div>
        </div>
        <div className="cx-cta-row">
          <ButtonLink href={GET_LISTED} arrow>
            List your business free
          </ButtonLink>
          <p>
            No CarworX fee during the pilot. You keep control of your hours.
          </p>
        </div>
      </section>

      <section className="cx-closing" aria-labelledby="h-close">
        <div className="mark">
          <Mark />
        </div>
        <h2 className="cx-h2" id="h-close">
          <span className="ln">Your car&apos;s next visit, </span>
          <span className="ln grey">found properly.</span>
        </h2>
        <div className="cx-cta-row">
          <ButtonLink href="#find" arrow>
            Find a service near you
          </ButtonLink>
          <TextLink href={GET_LISTED}>List your business free</TextLink>
        </div>
      </section>
    </PublicShell>
  );
}
