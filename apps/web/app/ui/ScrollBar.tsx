import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/**
 * Filter and tab bars stay on one line and scroll sideways (owner rule,
 * 2026-11-12). This hook keeps the edge fades honest (only on the side with
 * more), turns a vertical wheel into a sideways scroll, and keeps the chosen
 * item in view. `selectedKey` changes re-run the scroll-into-view.
 */
export function useEdgeFades(
  ref: RefObject<HTMLElement | null>,
  selectedKey: string | undefined,
): string {
  const [edges, setEdges] = useState({ l: false, r: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const l = el.scrollLeft > 2;
    const r = max - el.scrollLeft > 2;
    setEdges((e) => (e.l === l && e.r === r ? e : { l, r }));
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (
        (e.deltaY < 0 && el.scrollLeft <= 0) ||
        (e.deltaY > 0 && el.scrollLeft >= max)
      )
        return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("scroll", measure, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", measure);
    measure();
    return () => {
      el.removeEventListener("scroll", measure);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", measure);
    };
  }, [ref, measure]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = el.querySelector<HTMLElement>(
      '[aria-pressed="true"], [aria-selected="true"]',
    );
    if (on) {
      const left = on.offsetLeft - el.offsetLeft;
      if (
        left < el.scrollLeft ||
        left + on.offsetWidth > el.scrollLeft + el.clientWidth
      )
        el.scrollLeft = Math.max(0, left - 8);
    }
    measure();
  }, [ref, selectedKey, measure]);

  return `${edges.l ? " more-l" : ""}${edges.r ? " more-r" : ""}`;
}

export interface BarOption {
  value: string;
  label: string;
}

/** A one-line, swipeable row of filter chips (aria-pressed). */
export function FilterBar({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly BarOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fades = useEdgeFades(ref, value);
  return (
    <div
      ref={ref}
      className={`cx-filterbar${fades}`}
      role="group"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="cx-chip"
          aria-pressed={o.value === value}
          onClick={() => {
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface TabItem {
  id: string;
  label: string;
  /** When set, the tab is a link (route-driven tabs). */
  href?: string;
}

/** A one-line, swipeable tab bar. Buttons, or links for route-driven tabs. */
export function TabBar({
  label,
  tabs,
  current,
  onSelect,
}: {
  label: string;
  tabs: readonly TabItem[];
  current: string;
  onSelect?: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fades = useEdgeFades(ref, current);
  return (
    <div
      ref={ref}
      className={`cx-tabs${fades}`}
      role="tablist"
      aria-label={label}
    >
      {tabs.map((t) =>
        t.href ? (
          <a
            key={t.id}
            role="tab"
            href={t.href}
            aria-selected={t.id === current}
          >
            {t.label}
          </a>
        ) : (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === current}
            onClick={() => onSelect?.(t.id)}
          >
            {t.label}
          </button>
        ),
      )}
    </div>
  );
}
