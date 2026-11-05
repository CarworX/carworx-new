import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

import { Icon } from "./Icon";
import { Spinner } from "./states/Spinner";

export type ButtonVariant = "primary" | "secondary" | "outline";

interface Common {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  block?: boolean;
  children: ReactNode;
}

const cls = (
  variant: ButtonVariant,
  size: "md" | "sm",
  block: boolean,
  arrow: boolean,
  extra?: string,
) =>
  [
    "cx-btn",
    // "outline" and "block" are Tailwind utilities too, so the classes differ.
    variant === "outline" ? "outlined" : variant,
    size === "sm" ? "sm" : "",
    block ? "wide" : "",
    arrow ? "arrow" : "",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");

type ButtonProps = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    /** A short wait after a tap: the arc spins, the label says what is happening. */
    busy?: boolean;
  };

/** A pill button. One primary per view; never signal orange. */
export function Button({
  variant = "secondary",
  size = "md",
  block = false,
  busy = false,
  children,
  className,
  type,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      onClick={(e) => {
        // A busy button keeps its size and focus but does nothing twice.
        if (busy) e.preventDefault();
        else onClick?.(e);
      }}
      type={type ?? "button"}
      className={cls(variant, size, block, busy, className)}
      {...(busy ? { "aria-busy": true, "aria-disabled": true } : {})}
    >
      {children}
      {busy ? (
        <span className="arr">
          <Spinner tone={variant === "primary" ? "light" : "blue"} />
        </span>
      ) : null}
    </button>
  );
}

type LinkProps = Common &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> & {
    href: string;
    /** The arrow disc: only on links that go somewhere. */
    arrow?: boolean;
  };

export function ButtonLink({
  variant = "primary",
  size = "md",
  block = false,
  arrow = false,
  children,
  className,
  ...rest
}: LinkProps) {
  return (
    <a {...rest} className={cls(variant, size, block, arrow, className)}>
      {children}
      {arrow ? (
        <span className="arr" aria-hidden="true">
          <Icon name="arrow" size="sm" />
        </span>
      ) : null}
    </a>
  );
}

/** The quiet text link ("List your business free"). */
export function QuietLink({
  className,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...rest}
      className={["cx-link", className ?? ""].filter(Boolean).join(" ")}
    />
  );
}

/** The underlined text link beside a pill ("Find a service"). */
export function TextLink({
  className,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...rest}
      className={["cx-tlink", className ?? ""].filter(Boolean).join(" ")}
    />
  );
}
