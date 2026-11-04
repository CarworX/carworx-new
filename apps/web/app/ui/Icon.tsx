import { ICONS, type IconName } from "./icons.generated";

export type { IconName };

interface IconProps {
  name: IconName;
  size?: "sm" | "md" | "lg";
  /** Give a label only when the icon carries meaning on its own. */
  label?: string;
  className?: string;
}

/** A Studio UI glyph (brand/exports/studio/icons), drawn in currentColor. */
export function Icon({ name, size = "md", label, className }: IconProps) {
  const cls = ["cx-ic", size === "md" ? "" : size, className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
    >
      {ICONS[name].map(([tag, a], i) =>
        tag === "path" ? (
          <path key={i} {...a} />
        ) : tag === "circle" ? (
          <circle key={i} {...a} />
        ) : (
          <rect key={i} {...a} />
        ),
      )}
    </svg>
  );
}
