import { useState } from "react";

/** A dashboard number: large and thin, the currency prefix at 42 %. */
export function KpiCard({
  label,
  prefix,
  value,
  foot,
  fill,
  fee,
}: {
  label: string;
  prefix?: string;
  value: string;
  foot: string;
  fill?: number;
  fee?: boolean;
}) {
  return (
    <div className={fee ? "cx-kpi fee" : "cx-kpi"}>
      <small>{label}</small>
      <span className="num">
        {prefix ? <sub>{prefix}</sub> : null}
        {value}
      </span>
      <div className="foot">
        {fill !== undefined ? (
          <span className="bar" aria-hidden="true">
            <i style={{ width: `${String(Math.round(fill * 100))}%` }} />
          </span>
        ) : null}
        <span>{foot}</span>
      </div>
    </div>
  );
}

/** A period switch for the dashboard (tabs pattern, arrow keys move). */
export function PeriodTabs({
  options,
  label,
}: {
  options: readonly string[];
  label: string;
}) {
  const [sel, setSel] = useState(0);
  return (
    <div className="cx-tabs" role="tablist" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          role="tab"
          aria-selected={i === sel}
          tabIndex={i === sel ? 0 : -1}
          onClick={() => {
            setSel(i);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            const n =
              (i + (e.key === "ArrowRight" ? 1 : options.length - 1)) %
              options.length;
            setSel(n);
            const sib = e.currentTarget.parentElement?.children[n];
            if (sib instanceof HTMLElement) sib.focus();
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
