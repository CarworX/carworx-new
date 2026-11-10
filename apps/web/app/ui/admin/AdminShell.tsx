import type { ReactNode } from "react";

import { PublicShell } from "../public/PublicShell";

const LINKS = [
  { href: "/admin/listings?status=submitted", label: "Review queue" },
  { href: "/admin/listings?status=live", label: "Live" },
  { href: "/admin/listings?status=suspended", label: "Suspended" },
  { href: "/admin/claims", label: "Claims" },
] as const;

/** The admin frame: the public shell plus an admin sub-navigation. */
export function AdminShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <PublicShell signedIn>
      <p className="cx-eyebrow">Admin</p>
      <h1 className="type-display-lg mt-1">{title}</h1>
      <nav aria-label="Admin" className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {LINKS.map((l) => (
          <a key={l.href} className="cx-tlink" href={l.href}>
            {l.label}
          </a>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </PublicShell>
  );
}
