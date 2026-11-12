import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { CsrfField } from "../auth/ui";
import { Lockup } from "./brand/Lockup";
import { Icon } from "./Icon";

export interface NavItem {
  href: string;
  label: string;
}

interface NavBarProps {
  items: readonly NavItem[];
  /** The href of the current section. Only that item gets aria-current (G9). */
  current?: string;
  homeHref?: string;
  /** The one action on the right (the business action). */
  action?: ReactNode;
  /** The driver action, primary inside the menu sheet. */
  sheetActions?: ReactNode;
  /** Signed-in person: shows the account menu (settings, security, sign out). */
  account?: AccountInfo;
}

export interface AccountInfo {
  name: string;
  /** Role line, for example "Owner · Shine Bay Car Wash". */
  sub: string;
  initials: string;
  /** Profile and settings, Security and two-step sign-in, and so on. */
  links: readonly NavItem[];
  /** CSRF token for the sign-out POST (sign-out never happens on GET). */
  csrf: string;
}

function SignOut({ csrf }: { csrf: string }) {
  return (
    <form method="post" action="/auth/sign-out" className="cx-acct-out">
      <CsrfField token={csrf} />
      <button type="submit">Sign out</button>
    </form>
  );
}

/**
 * Every signed-in user reaches settings and sign-out from the menu (owner
 * rule, 2026-11-12). Desktop: an avatar button and a dropdown. Esc closes it
 * and returns focus; a click outside closes it.
 */
export function AccountMenu({ account }: { account: AccountInfo }) {
  const [open, setOpen] = useState(false);
  const dropId = useId();
  const me = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      me.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (
        e.target instanceof Node &&
        !box.current?.contains(e.target) &&
        !me.current?.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  return (
    <div className="cx-acct">
      <button
        ref={me}
        type="button"
        className="cx-acct-me"
        aria-expanded={open}
        aria-controls={dropId}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <span className="av" aria-hidden="true">
          {account.initials}
        </span>
        <span className="cx-vh">Account menu for {account.name}</span>
      </button>
      <div ref={box} id={dropId} className="cx-acct-drop" hidden={!open}>
        <p className="who">
          <b>{account.name}</b>
          <small>{account.sub}</small>
        </p>
        {account.links.map((l) => (
          <a key={l.href} className="row" href={l.href}>
            {l.label}
          </a>
        ))}
        <SignOut csrf={account.csrf} />
      </div>
    </div>
  );
}

/** The frosted nav pill. At 1060 px and below the links move into a sheet. */
export function NavBar({
  items,
  current,
  homeHref = "/",
  action,
  sheetActions,
  account,
}: NavBarProps) {
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const s = sheet.current;
    const focusables = () =>
      s
        ? [...s.querySelectorAll<HTMLElement>("a[href],button:not([disabled])")]
        : [];
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      // Tab stays between the menu button and the sheet.
      const ring = [button.current, ...focusables()].filter(
        (el): el is HTMLElement => el !== null,
      );
      const i = ring.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey
        ? i <= 0
          ? ring.length - 1
          : i - 1
        : i === ring.length - 1
          ? 0
          : i + 1;
      e.preventDefault();
      ring[next]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cur = (href: string) =>
    href === current ? ({ "aria-current": "page" } as const) : {};
  return (
    <header>
      <nav className="cx-nav" aria-label="Main">
        <a className="logo" href={homeHref}>
          <Lockup title="CarworX home" />
        </a>
        <ul className="links">
          {items.map((it) => (
            <li key={it.href}>
              <a href={it.href} {...cur(it.href)}>
                {it.label}
              </a>
            </li>
          ))}
        </ul>
        {action ? <div className="act">{action}</div> : null}
        {account ? <AccountMenu account={account} /> : null}
        <button
          ref={button}
          type="button"
          className="cx-menu"
          aria-expanded={open}
          aria-controls={sheetId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => {
            setOpen(!open);
          }}
        >
          <i />
          <i />
        </button>
      </nav>
      <div
        ref={sheet}
        id={sheetId}
        className="cx-sheet"
        role="dialog"
        aria-label="Menu"
        hidden={!open}
        onClick={(e) => {
          // Any link or action in the sheet ends the menu, and with it the
          // focus trap, so an in-page link (#services) leaves focus free.
          if (e.target instanceof Element && e.target.closest("a,button"))
            setOpen(false);
        }}
      >
        <ul>
          {items.map((it) => (
            <li key={it.href}>
              <a className="row" href={it.href} {...cur(it.href)}>
                {it.label}
                <Icon name="chev" />
              </a>
            </li>
          ))}
        </ul>
        {sheetActions ? <div className="acts">{sheetActions}</div> : null}
        {account ? (
          <div className="cx-acct-sheet">
            <p className="who">
              <span className="av" aria-hidden="true">
                {account.initials}
              </span>
              <span>
                <b>{account.name}</b>
                <small>{account.sub}</small>
              </span>
            </p>
            <ul>
              {account.links.map((l) => (
                <li key={l.href}>
                  <a className="row" href={l.href}>
                    {l.label}
                    <Icon name="chev" />
                  </a>
                </li>
              ))}
            </ul>
            <SignOut csrf={account.csrf} />
          </div>
        ) : null}
      </div>
    </header>
  );
}
