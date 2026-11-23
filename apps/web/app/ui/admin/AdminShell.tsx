import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { Icon, type IconName } from "../Icon";
import { PublicShell } from "../public/PublicShell";
import "./admin.css";

const LINKS = [
  { href: "/admin/today", label: "Today" },
  { href: "/admin/listings?status=submitted", label: "Applications" },
  { href: "/admin/listings?status=live", label: "Businesses" },
  { href: "/admin/listings?status=suspended", label: "Suspended" },
  { href: "/admin/claims", label: "Claims" },
  { href: "/admin/demand", label: "Demand" },
  { href: "/admin/support", label: "Support" },
  { href: "/admin/audit", label: "Audit log" },
] as const;

/** The admin frame: the public shell plus an admin sub-navigation. */
export function AdminShell({
  title,
  listingStatus,
  children,
}: {
  title: string;
  listingStatus?: string;
  children: ReactNode;
}) {
  const { pathname, search } = useLocation();
  const listStatus = listingStatus ?? new URLSearchParams(search).get("status");
  const current =
    pathname === "/admin/listings" || pathname.startsWith("/admin/listings/")
      ? `/admin/listings?status=${listStatus === "live" || listStatus === "suspended" ? listStatus : "submitted"}`
      : pathname === "/admin"
        ? null
        : pathname.split("/").slice(0, 3).join("/");
  return (
    <PublicShell signedIn>
      <div className="cx-admin-workspace">
        <header className="cx-admin-head">
          <p className="cx-eyebrow">Admin</p>
          <h1>{title}</h1>
        </header>
        <nav aria-label="Admin" className="cx-admin-nav">
          {LINKS.map((l) => (
            <a
              key={l.href}
              className="cx-chip"
              href={l.href}
              aria-current={current === l.href ? "page" : undefined}
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div>{children}</div>
      </div>
    </PublicShell>
  );
}

/** A full-width row link for a review or support queue. */
export function QueueRowLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: ReactNode;
  icon: IconName;
}) {
  return (
    <a href={href} className="cx-admin-row">
      <span className="cx-admin-row-icon">
        <Icon name={icon} />
      </span>
      <span className="cx-admin-row-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <Icon name="chev" size="sm" />
    </a>
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
