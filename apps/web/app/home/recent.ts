/**
 * "Recently viewed" for the signed-in home (redesign A4, C3). Kept in this
 * browser only (localStorage), never sent to the server. The last three
 * listings a visitor opened, newest first.
 */

export interface RecentView {
  id: string;
  name: string;
  service: string;
}

export const RECENT_KEY = "cx-recent-views";
export const RECENT_MAX = 3;
const RECENT_EVENT = "cx-recent-change";

/** A listing id is a UUID; anything else in storage is ignored. */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Some browsers throw when storage is blocked.
    return null;
  }
}

function isView(value: unknown): value is RecentView {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { id?: unknown; name?: unknown; service?: unknown };
  return (
    typeof v.id === "string" &&
    ID.test(v.id) &&
    typeof v.name === "string" &&
    typeof v.service === "string"
  );
}

/** Parses the stored value; anything malformed reads as an empty history. */
export function parseRecent(raw: string | null): RecentView[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(isView).slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

export function readRecent(
  storage: Storage | null = browserStorage(),
): RecentView[] {
  try {
    return parseRecent(storage?.getItem(RECENT_KEY) ?? null);
  } catch {
    return [];
  }
}

/** Tells the same-tab listeners that the history changed. */
function announce(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(RECENT_EVENT));
}

/** Raw stored value, for useSyncExternalStore (a string compares by value). */
export function snapshotRecent(): string | null {
  try {
    return browserStorage()?.getItem(RECENT_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Subscribes to changes in this tab and, for other tabs, to storage events. */
export function subscribeRecent(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === RECENT_KEY || e.key === null) onChange();
  };
  window.addEventListener(RECENT_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(RECENT_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Puts a listing at the front, drops its older copy, keeps the newest three. */
export function rememberView(
  view: RecentView,
  storage: Storage | null = browserStorage(),
): void {
  if (storage === null || !isView(view)) return;
  const next = [view, ...readRecent(storage).filter((r) => r.id !== view.id)];
  try {
    storage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, RECENT_MAX)));
    announce();
  } catch {
    // Full or blocked storage: the history is simply not kept.
  }
}

export function clearRecent(storage: Storage | null = browserStorage()): void {
  try {
    storage?.removeItem(RECENT_KEY);
    announce();
  } catch {
    // Nothing to clear when storage is blocked.
  }
}
