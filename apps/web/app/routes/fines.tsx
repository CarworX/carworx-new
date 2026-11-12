import { TextLink } from "../ui/Button";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/fines";

export const meta: Route.MetaFunction = () => [
  { title: "Fines & vehicle admin · CarworX" },
  {
    name: "description",
    content:
      "How traffic fines work in South Africa and where to check them officially. CarworX never asks for your ID number.",
  },
];

/** Static guidance: no personal data, no form, so it may be cached. */
export const headers: Route.HeadersFunction = () => ({
  "Cache-Control": "public, max-age=300",
});

/**
 * Official referral links (P2-6, A14). Only sites read and confirmed on the
 * date shown; a link that can't be confirmed is left out, not guessed. Each
 * label names only what the site itself says about who runs it.
 */
export const OFFICIAL_LINKS = [
  {
    href: "https://rtmc.co.za/",
    name: "Road Traffic Management Corporation (RTMC)",
    runBy:
      "The site identifies its operator as the Road Traffic Management Corporation.",
    use: "Official RTMC information and services; this is not a complete fines search.",
    checked: "2026-11-11",
  },
  {
    href: "https://www.rtia.co.za/",
    name: "Road Traffic Infringement Agency (RTIA)",
    runBy:
      "The RTIA says it is the only body legally authorised to administer and process fines under the AARTO Act.",
    use: "Its “Check your fines” button opens the official AARTO fine checker.",
    checked: "2026-11-11",
  },
] as const;

/**
 * /fines (P2-6, A14). Guidance and labelled official referrals only. There is
 * no lookup (G-FINES is out of scope) and no field of any kind: CarworX never
 * asks for an ID, licence or registration number here.
 */
export default function Fines() {
  return (
    <PublicShell current="/fines">
      <h1 className="type-display-lg max-sm:text-[34px] max-sm:leading-[36px]">
        Fines & vehicle admin
      </h1>
      <div className="mt-6 grid max-w-[65ch] gap-8">
        <StatusNote title="CarworX doesn't check or collect fines.">
          We point you to the official places instead. We never ask for your ID
          number, and you can't pay a fine through CarworX.
        </StatusNote>

        <section aria-labelledby="none-h" className="grid gap-3">
          <h2 id="none-h" className="type-heading">
            “No fines found” doesn't always mean you have none
          </h2>
          <p className="type-body">
            Different authorities issue fines and keep their own records. One
            site showing nothing doesn't mean another has nothing for you. A
            fine may also take a while to appear after it's issued.
          </p>
          <ul className="type-body grid list-disc gap-1 pl-6">
            <li>
              <b>AARTO infringements</b> are handled nationally through the
              RTIA, in the areas where AARTO applies.
            </li>
            <li>
              <b>Municipal and provincial traffic fines</b> are kept by the
              traffic department or court that issued them. Use the contact
              details printed on your notice.
            </li>
          </ul>
          <p className="type-body">
            If you're unsure, check with each authority that may have issued a
            fine to you, and keep any notice you receive.
          </p>
        </section>

        <section aria-labelledby="official-h" className="grid gap-3">
          <h2 id="official-h" className="type-heading">
            Official places to check
          </h2>
          <ul className="grid gap-3" data-official-links>
            {OFFICIAL_LINKS.map((l) => (
              <li
                key={l.href}
                className="rounded-2xl bg-[var(--surface)] p-4"
                data-official={l.href}
              >
                <p className="type-body">
                  <TextLink href={l.href} rel="noopener noreferrer">
                    {l.name}
                  </TextLink>{" "}
                  <span className="type-caption">
                    (official site, opens {new URL(l.href).hostname})
                  </span>
                </p>
                <p className="type-body-sm mt-1">{l.runBy}</p>
                <p className="type-body-sm mt-1">{l.use}</p>
                <p className="type-caption mt-1">Link checked {l.checked}.</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="scam-h" className="grid gap-3">
          <h2 id="scam-h" className="type-heading">
            Watch out for fake fine sites
          </h2>
          <p className="type-body">
            The RTIA warns of fraudulent websites posing as the official AARTO
            platform, and of fake payment links sent by SMS, WhatsApp and email.
            Type the official address yourself rather than following a link in a
            message, and never share your banking details with a site you didn't
            open that way.
          </p>
        </section>
      </div>
    </PublicShell>
  );
}
