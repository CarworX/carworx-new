import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * False while the page is server-rendered, true once the browser runs React.
 * Lets a control wait for JavaScript without leaving a disabled button in the
 * HTML: with JavaScript off, the native `required` check still applies.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
