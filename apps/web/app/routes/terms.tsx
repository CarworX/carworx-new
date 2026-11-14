import source from "../../../../planning/legal/terms-free-site.md?raw";
import { LegalDocument } from "../legal/markdown";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/terms";

export const meta: Route.MetaFunction = () => [
  { title: "Terms of use · CarworX" },
  {
    name: "description",
    content:
      "The terms for using the free CarworX directory: search, listings, accounts, provider applications and enquiries.",
  },
];

/** Static text, no personal data: it may be cached. */
export const headers: Route.HeadersFunction = () => ({
  "Cache-Control": "public, max-age=300",
});

/**
 * /terms (G-PROD E2). Rendered from planning/legal/terms-free-site.md so the page
 * and the reviewed draft can't drift apart. Reviewer notes are stripped. The
 * draft notice stays until the owner approves the text (D-045).
 */
export default function Page() {
  return (
    <PublicShell current="/terms">
      <h1 className="type-display-lg max-sm:text-[34px] max-sm:leading-[36px]">
        Terms of use
      </h1>
      <div className="mt-6 grid max-w-[70ch] gap-6">
        <StatusNote title="This is a draft, not yet approved.">
          Items in square brackets are still to be confirmed. The final version
          will be published here before CarworX launches.
        </StatusNote>
        <LegalDocument source={source} />
      </div>
    </PublicShell>
  );
}
