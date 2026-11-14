import { useEffect, useState } from "react";
import { useNavigation } from "react-router";

import { PageLoader } from "./PageLoader";

/** A wait shorter than this never shows the loader (owner, 14 Nov). */
export const LOADER_DELAY_MS = 300;

/**
 * Whether a click starts a same-site page load we should cover: a plain
 * left click on an http(s) link to another page of this origin, not a new
 * tab, download, mailto/tel or in-page anchor.
 */
export function isPageLoadClick(
  event: Pick<
    MouseEvent,
    | "button"
    | "metaKey"
    | "ctrlKey"
    | "shiftKey"
    | "altKey"
    | "defaultPrevented"
  >,
  anchor: Pick<HTMLAnchorElement, "href" | "target" | "hasAttribute"> | null,
  here: URL,
): boolean {
  if (!anchor || event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return false;
  if (
    (anchor.target && anchor.target !== "_self") ||
    anchor.hasAttribute("download")
  )
    return false;
  let to: URL;
  try {
    to = new URL(anchor.href, here);
  } catch {
    return false;
  }
  if (to.protocol !== "http:" && to.protocol !== "https:") return false;
  if (to.origin !== here.origin) return false;
  // Same page with only a different hash: no load.
  if (to.pathname === here.pathname && to.search === here.search && to.hash)
    return false;
  return true;
}

/** True once `active` has stayed true for `delay` ms; false at once after. */
export function useDelayedFlag(active: boolean, delay = LOADER_DELAY_MS) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => {
      setElapsed(true);
    }, delay);
    return () => {
      clearTimeout(id);
      setElapsed(false);
    };
  }, [active, delay]);
  return active && elapsed;
}

/**
 * The Studio PageLoader, once for the whole app. It covers React Router
 * navigations and the plain links and native forms most pages use, and only
 * after LOADER_DELAY_MS, so instant pages never flash it.
 */
export function NavigationLoader() {
  const navigation = useNavigation();
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a =
        e.target instanceof Element ? e.target.closest("a[href]") : null;
      // Let the link's own handlers run first; a prevented click is no load.
      setTimeout(() => {
        if (
          isPageLoadClick(
            e,
            a instanceof HTMLAnchorElement ? a : null,
            new URL(location.href),
          )
        )
          setLeaving(true);
      }, 0);
    };
    const onSubmit = (e: SubmitEvent) => {
      setTimeout(() => {
        if (!e.defaultPrevented) setLeaving(true);
      }, 0);
    };
    // Back/forward cache: the page comes back as it was left.
    const onShow = () => {
      setLeaving(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);
  const show = useDelayedFlag(leaving || navigation.state !== "idle");
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2147482000 }}>
      <PageLoader />
    </div>
  );
}
