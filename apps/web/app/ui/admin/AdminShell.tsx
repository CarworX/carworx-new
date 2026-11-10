import type { ReactNode } from "react";

import { PublicShell } from "../public/PublicShell";

const LINKS = [
  { href: "/admin/listings?status=submitted", label: "Review queue" },
  { href: "/admin/listings?status=live", label: "Live" },
  { href: "/admin/listings?status=suspended", label: "Suspended" },
  { href: "/admin/claims", label: "Claims" },
  { href: "/admin/audit", label: "Audit log" },
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

/** Previous / next links for an admin list. `base` already holds any query. */
export function Pager({
  base,
  page,
  more,
}: {
  base: string;
  page: number;
  more: boolean;
}) {
  const join = base.endsWith("?") ? "" : "&";
  if (page === 1 && !more) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex gap-4" data-pager={page}>
      {page > 1 ? (
        <a className="cx-tlink" href={`${base}${join}page=${String(page - 1)}`}>
          Previous
        </a>
      ) : null}
      {more ? (
        <a
          className="cx-tlink"
          href={`${base}${join}page=${String(page + 1)}`}
          data-next
        >
          Next
        </a>
      ) : null}
    </nav>
  );
}
