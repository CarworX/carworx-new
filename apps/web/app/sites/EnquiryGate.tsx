import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * D-097: the sign-in step a signed-out visitor sees when they send an
 * enquiry (planning/landing-redesign/mockup.html, "desktop-gate" and the
 * phone sheet). A centred card on desktop, a bottom sheet on phones.
 *
 * With JavaScript it opens as a modal <dialog> (focus trap and Escape come
 * with showModal). Without JavaScript the form posts, the server answers
 * "account_required" and the page renders this already open.
 */
export function EnquiryGate({
  open,
  onClose,
  provider,
  returnTo,
}: {
  open: boolean;
  onClose?: () => void;
  provider: string;
  returnTo: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Until hydration the dialog is a plain open element (the no-JavaScript
  // answer); after it, showModal() takes over.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !hydrated) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) dialog.close();
  }, [open, hydrated]);
  const back = encodeURIComponent(returnTo);
  return (
    <dialog
      ref={ref}
      className="gate"
      aria-labelledby="gate-h"
      aria-describedby="gate-p"
      open={open && !hydrated ? true : undefined}
      onClose={onClose}
    >
      <div className="gate-grab" aria-hidden="true" />
      <h2 id="gate-h">Sign in to send your enquiry</h2>
      <p id="gate-p">
        A free account lets {provider} reply to you, and keeps your bookings and
        messages in one place.
      </p>
      <div className="gate-keep" role="status">
        ✓ Your message is kept. You'll come straight back here.
      </div>
      <a className="btn" href={`/auth/sign-up?returnTo=${back}`}>
        Create free account
      </a>
      <a className="btn secondary" href={`/auth/sign-in?returnTo=${back}`}>
        I already have an account
      </a>
      {onClose ? (
        <button
          type="button"
          className="gate-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      ) : null}
    </dialog>
  );
}

const TTL_MS = 60 * 60 * 1000;

/**
 * "Your message is kept": the draft waits in this browser for an hour, so it
 * survives the sign-in or sign-up round trip, including a confirmation link
 * opened in a new tab (which a per-tab sessionStorage would lose). It is
 * removed as soon as the message is sent, and it never leaves the browser.
 */
export function useEnquiryDraft(listingId: string) {
  const key = `cx-enquiry-draft:${listingId}`;
  const save = useCallback(
    (message: string) => {
      try {
        if (message.trim() === "") localStorage.removeItem(key);
        else
          localStorage.setItem(
            key,
            JSON.stringify({ m: message.slice(0, 1000), at: Date.now() }),
          );
      } catch {
        // Storage can be off (private mode); the step still works.
      }
    },
    [key],
  );
  const restore = useCallback((): string | null => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      const draft = JSON.parse(raw) as { m?: unknown; at?: unknown };
      if (
        typeof draft.m !== "string" ||
        typeof draft.at !== "number" ||
        Date.now() - draft.at > TTL_MS
      ) {
        localStorage.removeItem(key);
        return null;
      }
      return draft.m;
    } catch {
      return null;
    }
  }, [key]);
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to clear.
    }
  }, [key]);
  return { save, restore, clear };
}
