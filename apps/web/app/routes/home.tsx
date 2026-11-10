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

export default function Home() {
  return (
    <PublicShell current="/">
      <p className="cx-eyebrow">Free to search · no account needed</p>
      <h1 className="type-display-lg mt-3 max-sm:text-[34px] max-sm:leading-[36px]">
        Find trusted car services near you.
      </h1>
      <p className="type-lede mt-3 max-w-[60ch] text-quiet">
        Workshops you can visit and mobile providers who come to you. Every
        label says exactly what we checked.
      </p>
      <div className="mt-8">
        <SearchForm />
      </div>
      <h2 className="type-heading mt-12">Browse by service</h2>
      <div className="mt-4">
        <ServiceKeys hrefs={SERVICE_HREFS} />
      </div>
    </PublicShell>
  );
}
