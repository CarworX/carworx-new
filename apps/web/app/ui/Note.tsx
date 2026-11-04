import type { ReactNode } from "react";

import nothing from "../../../../planning/design/brand/exports/studio/illustrations/carworx-ill-nothing.svg?url";
import { Icon, type IconName } from "./Icon";

export type NoteTone = "info" | "ok" | "warn" | "err";
const ICON: Record<NoteTone, IconName> = {
  info: "info",
  ok: "check",
  warn: "clock",
  err: "alert",
};

/** Sentence first: what happened, then what it means. Icon and words. */
export function StatusNote({
  tone = "info",
  title,
  children,
}: {
  tone?: NoteTone;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={tone === "info" ? "cx-note" : `cx-note ${tone}`}
      role={tone === "err" ? "alert" : undefined}
    >
      <Icon name={ICON[tone]} />
      <p>
        <b>{title}</b> {children}
      </p>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
  illustration = nothing,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  illustration?: string;
}) {
  return (
    <div className="cx-empty">
      <img src={illustration} alt="" width={96} height={68} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
