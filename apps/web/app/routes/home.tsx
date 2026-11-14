import homeCss from "../home/home.css?url";
import markup from "../home/preview.html?raw";
import type { Route } from "./+types/home";

/**
 * The home page is the owner-approved Sites preview home, verbatim
 * (planning/sites-customer-preview/dist on #83 @ b88a8ca). app/home/ is
 * generated from it; only the hosting band is gone, the links go to real
 * routes, Sign in / Sign up are added and no demo wording remains. Its
 * stylesheet and script load on this route only.
 */
export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: homeCss },
];

export const meta: Route.MetaFunction = () => [
  { title: "CarworX · Car care, booked properly" },
  {
    name: "description",
    content:
      "Washes, repairs, glass and tyres from businesses near you, plus straight answers on fines and vehicle admin. You pay the business directly.",
  },
];

/** Public, no personal data: may be cached briefly by browsers. */
export const headers: Route.HeadersFunction = () => ({
  "Cache-Control": "public, max-age=300",
});

export default function Home() {
  return (
    <>
      {/* First-visit intro (owner, 14 Nov): runs before the page paints, once
          per browser, never with reduced motion; without JS nothing runs. */}
      <div
        id="cx-intro"
        aria-hidden="true"
        hidden
        // The intro script fills and removes this before and after hydration.
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: "" }}
      />
      <script src="/intro/intro.js" />
      <div
        className="cx-home"
        // home.js draws into this markup (ticks, clocks) before hydration.
        suppressHydrationWarning
        // Static, generated markup from the repository; no user input.
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      <script src="/home/home.js" defer />
    </>
  );
}
