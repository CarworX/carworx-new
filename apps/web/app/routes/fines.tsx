import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/fines";

export const meta: Route.MetaFunction = () => [
  { title: "Fines & vehicle admin · CarworX" },
];

export const headers: Route.HeadersFunction = () => ({
  "Cache-Control": "public, max-age=300",
});

/** Placeholder until P2-6 adds guidance and labelled official referrals (A14). */
export default function Fines() {
  return (
    <PublicShell current="/fines">
      <h1 className="type-display-lg">Fines & vehicle admin</h1>
      <div className="mt-6 max-w-[60ch]">
        <StatusNote title="Guidance is on its way.">
          We will link to the official places to check and pay traffic fines.
          CarworX never asks for your ID number.
        </StatusNote>
      </div>
    </PublicShell>
  );
}
