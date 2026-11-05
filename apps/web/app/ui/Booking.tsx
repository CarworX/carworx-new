import type { ReactNode } from "react";

import { Icon } from "./Icon";

/** Sticky-note paper, in the hand face. Never for anything a person must act on. */
export function StickyNote({
  lines,
}: {
  lines: readonly [string, ...string[]];
}) {
  return (
    <div className="cx-sticky">
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
}

/** The booking confirmed: a tile with the blue tick. */
export function BookingTile({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle: string;
  meta: readonly [string, string];
}) {
  return (
    <div className="cx-tile">
      <div className="row">
        <span className="cx-tick">
          <Icon name="check" />
        </span>
        <div>
          <b>{title}</b>
          <small>{subtitle}</small>
        </div>
      </div>
      <div className="meta">
        <span>{meta[0]}</span>
        <span>{meta[1]}</span>
      </div>
    </div>
  );
}

export interface ReceiptLine {
  label: string;
  amount: string;
  /** A line replaced by a newer quote version. */
  old?: boolean;
}

/** The quote or receipt slip, in mono, with a torn edge. */
export function Receipt({
  title,
  lines,
  total,
  stamp,
}: {
  title: string;
  lines: readonly ReceiptLine[];
  total: ReceiptLine;
  stamp?: ReactNode;
}) {
  return (
    <div className="cx-receipt">
      <h3>{title}</h3>
      {lines.map((l) => (
        <div key={l.label} className={l.old ? "ln old" : "ln"}>
          <span>{l.label}</span>
          <span>{l.amount}</span>
        </div>
      ))}
      <hr />
      <div className="ln tot">
        <span>{total.label}</span>
        <span>{total.amount}</span>
      </div>
      {stamp ? <span className="stamp">{stamp}</span> : null}
    </div>
  );
}
