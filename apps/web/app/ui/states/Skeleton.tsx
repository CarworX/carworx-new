import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const sk = (style: CSSProperties) => <span className="cx-sk" style={style} />;

/** A skeleton result card: the layout is known, the data is not yet here. */
export function SkeletonCard({ i = 0 }: { i?: number }) {
  return (
    <div className="cx-skc">
      <span className="cx-sk t" />
      <div className="ls">
        {sk({ width: ["62%", "54%", "70%", "58%"][i % 4], height: 16 })}
        {sk({ width: "86%", height: 11 })}
        {sk({ width: "40%", height: 11 })}
        <div className="pills">
          {sk({ width: 84, height: 28, borderRadius: 999 })}
          {sk({ width: 64, height: 28, borderRadius: 999 })}
        </div>
      </div>
    </div>
  );
}

/** One row still loading inside a list that is already there. */
export function SkeletonRow() {
  return (
    <div className="cx-skr">
      {sk({ width: 52, height: 52, borderRadius: 12 })}
      <div className="ls">
        {sk({ width: "70%", height: 12 })}
        {sk({ width: "90%", height: 10 })}
      </div>
      {sk({ width: 44, height: 22, borderRadius: 6 })}
    </div>
  );
}

/**
 * Wraps skeletons: one status for assistive tech, the blocks hidden from it.
 * One sweep crosses the whole group: each block's shimmer starts by its x.
 */
export function SkeletonGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth || 1;
    for (const s of el.querySelectorAll<HTMLElement>(".cx-sk")) {
      const b = s.getBoundingClientRect();
      s.style.setProperty(
        "--d",
        `${(-(1 - (b.left + b.width / 2) / vw) * 0.55).toFixed(3)}s`,
      );
    }
  }, []);
  return (
    <div role="status">
      <span className="cx-vh">{label}</span>
      <div ref={ref} aria-hidden="true" className="grid gap-3">
        {children}
      </div>
    </div>
  );
}
