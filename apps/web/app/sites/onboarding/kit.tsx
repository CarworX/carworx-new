/**
 * The onboarding preview's kit (#83 @ b88a8ca, onboarding/_shared/kit.js),
 * as server-rendered React. Markup and class names match what kit.js draws,
 * so kit.css styles them unchanged. Answers are real form fields.
 */
import type { ReactNode } from "react";

const ICONS = {
  store: <path d="M4 10v9h16v-9M3 10l2-6h14l2 6M3 10h18M9 19v-5h6v5" />,
  van: (
    <path d="M3 16V7h11v9M14 10h4l3 3v3h-7M7.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  doc: <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />,
  tick: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  lock: <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />,
  pin: (
    <>
      <path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
  loc: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M3 19a6 6 0 0 1 12 0M16 6.5a3 3 0 0 1 0 5.5M17.5 19H21a5 5 0 0 0-4-5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
} as const;
export type ObIconName = keyof typeof ICONS;

export function ObIcon({
  name,
  style,
}: {
  name: ObIconName;
  style?: React.CSSProperties;
}) {
  return (
    <svg className="ob-ic" viewBox="0 0 24 24" aria-hidden="true" style={style}>
      {ICONS[name]}
    </svg>
  );
}

/** The focused app bar: logo, what this is, and a way out. */
export function ObNav({
  label,
  exitHref,
  exitText = "Save and exit",
}: {
  label: string;
  exitHref: string;
  exitText?: string;
}) {
  // The preview's bar sits in a short wrapper, so it scrolls with the page.
  return (
    <div>
      <div className="ob-navwrap">
        <nav className="cx-nav" aria-label="CarworX">
          <a className="logo" href="/" aria-label="CarworX home">
            <img
              src="/assets/core/carworx-lockup-horizontal-ink.svg"
              alt="CarworX"
              width={116}
              height={24}
            />
          </a>
          <div className="act">
            <span className="ob-demo">{label}</span>
            <a className="cx-btn outlined sm" href={exitHref}>
              {exitText}
            </a>
          </div>
        </nav>
      </div>
    </div>
  );
}

/** Segment bar: one segment per step, filled up to the current one. */
export function SegBar({
  name,
  at,
  total,
  label,
  className = "",
}: {
  name: string;
  at: number;
  total: number;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`ob-segbar still ${className}`.trim()}
      aria-label={label}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={at + 1}
      aria-valuetext={`Step ${String(at + 1)} of ${String(total)}: ${name}`}
    >
      <div className="segrow">
        <span className="segname" aria-hidden="true">
          {name}
        </span>
        <span className="segcount" aria-hidden="true">
          {at + 1} of {total}
        </span>
      </div>
      <div className="segs">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`seg${i <= at ? " on" : ""}${i === at ? " now" : ""}`}
          >
            <i />
          </span>
        ))}
      </div>
    </div>
  );
}

export interface RailItem {
  key: string;
  title: string;
  body: string;
  icon: ObIconName;
  href?: string;
}

/** The progress rail (Studio StepList look). Done steps link back. */
export function ObRail({
  items,
  current,
}: {
  items: readonly RailItem[];
  current: number;
}) {
  return (
    <ol className="cx-steps">
      {items.map((item, i) => {
        const inner = (
          <>
            <span className="k">
              <span className="n" aria-hidden="true" />
              <ObIcon name={item.icon} />
            </span>
            <div>
              <b>{item.title}</b>
              <p>{item.body}</p>
            </div>
          </>
        );
        return (
          <li
            key={item.key}
            className={i < current ? "done" : undefined}
            aria-current={i === current ? "step" : undefined}
          >
            {inner}
          </li>
        );
      })}
    </ol>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** The live listing preview card. Empty answers show their placeholders. */
export function ObListingCard({
  name,
  where,
  services,
  about,
  hours,
}: {
  name: string;
  where: string;
  services: readonly string[];
  about: string;
  hours: string;
}) {
  return (
    <article className="ob-card" aria-label="Listing preview">
      <div className="top">
        <span className="av" aria-hidden="true">
          {initials(name)}
        </span>
        <div>
          <h3 className={name ? "" : "empty"}>
            {name || "Your business name"}
          </h3>
          <p className="m">
            <span className={where ? "" : "empty"}>{where || "Your area"}</span>
          </p>
        </div>
      </div>
      <div className="svcs">
        {services.length ? (
          services.map((s) => <span key={s}>{s}</span>)
        ) : (
          <span className="empty">Your services</span>
        )}
      </div>
      <p className={`about${about ? "" : " empty"}`}>
        {about || "A short line about what you do."}
      </p>
      <p className="m">
        <ObIcon
          name="clock"
          style={{ width: 14, height: 14, verticalAlign: -2 }}
        />{" "}
        <span>{hours || "Your hours"}</span>
      </p>
      <div className="lbls">
        <span className="ob-lbl-off">
          Labels appear after an admin checks you
        </span>
      </div>
    </article>
  );
}

/** One question: title, optional hint, the control, and its error line. */
export function ObQ({
  id,
  title,
  hint,
  optional,
  group = true,
  htmlFor,
  error,
  children,
}: {
  id: string;
  title: ReactNode;
  hint?: ReactNode;
  optional?: boolean;
  group?: boolean;
  htmlFor?: string;
  error?: string | null;
  children: ReactNode;
}) {
  const t = `q-${id}-t`;
  const h = hint ? `q-${id}-h` : undefined;
  const heading = (
    <>
      {title}
      {optional ? (
        <>
          {" "}
          <span className="ob-opt">(optional)</span>
        </>
      ) : null}
    </>
  );
  return (
    <div
      className={`ob-q ob-q-${id}`}
      role={group ? "group" : undefined}
      aria-labelledby={group ? t : undefined}
      aria-describedby={group ? h : undefined}
    >
      {group ? (
        <p className="ob-qt" id={t}>
          {heading}
        </p>
      ) : (
        <label className="ob-qt" id={t} htmlFor={htmlFor}>
          {heading}
        </label>
      )}
      {hint ? (
        <p className="ob-qh" id={h}>
          {hint}
        </p>
      ) : null}
      {children}
      <p className="ob-err" role="alert">
        {error ?? ""}
      </p>
    </div>
  );
}

export interface TileOption {
  value: string;
  title: string;
  description?: string;
  icon?: ObIconName;
}

/** Big choice tiles (radio, or checkbox when multiple). */
export function ObTiles({
  name,
  options,
  multiple,
  required,
  defaultValue,
}: {
  name: string;
  options: readonly TileOption[];
  multiple?: boolean;
  required?: boolean;
  defaultValue: readonly string[] | string;
}) {
  const chosen =
    typeof defaultValue === "string" ? [defaultValue] : defaultValue;
  return (
    <div className="ob-tiles">
      {options.map((o) => (
        <label key={o.value} className={`ob-tile${multiple ? " multi" : ""}`}>
          <input
            type={multiple ? "checkbox" : "radio"}
            name={name}
            value={o.value}
            required={required && !multiple}
            defaultChecked={chosen.includes(o.value)}
          />
          {o.icon ? (
            <span className="ic">
              <ObIcon name={o.icon} />
            </span>
          ) : null}
          <b>{o.title}</b>
          {o.description ? <small>{o.description}</small> : null}
        </label>
      ))}
    </div>
  );
}

/** Pill chips you pick (radio, or checkbox when multiple). */
export function ObPicks({
  name,
  options,
  multiple,
  required,
  defaultValue,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  multiple?: boolean;
  required?: boolean;
  defaultValue: readonly string[] | string;
}) {
  const chosen =
    typeof defaultValue === "string" ? [defaultValue] : defaultValue;
  return (
    <div className="ob-picks">
      {options.map((o) => (
        <label key={o.value} className={`ob-pick${multiple ? " multi" : ""}`}>
          <input
            type={multiple ? "checkbox" : "radio"}
            name={name}
            value={o.value}
            required={required && !multiple}
            defaultChecked={chosen.includes(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** Back, the keyboard hint, and the primary action. */
export function ObActions({
  backHref,
  backText = "Back",
  cta,
  busy,
  keys = true,
  form,
}: {
  backHref?: string;
  backText?: string;
  cta: string;
  busy?: boolean;
  keys?: boolean;
  /** The form the button submits, when it sits outside that form. */
  form?: string;
}) {
  return (
    <div className="ob-actions">
      {backHref ? (
        <a className="ob-back" href={backHref}>
          {backText}
        </a>
      ) : null}
      {keys ? (
        <span className="ob-keys">
          <kbd>Enter</kbd> next · <kbd>Esc</kbd> back
        </span>
      ) : null}
      <button
        type="submit"
        form={form}
        className="cx-btn primary"
        aria-busy={busy || undefined}
      >
        {cta}
      </button>
    </div>
  );
}
