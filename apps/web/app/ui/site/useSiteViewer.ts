import { createContext, useContext } from "react";

import type { Viewer } from "./viewer";

export interface SiteData {
  viewer: Viewer | null;
  csrf: string;
}

/**
 * The root loader's data, provided once by the root App. The default is the
 * signed-out view, so a page rendered on its own (in tests, or before the root
 * loader has data) still renders the header correctly.
 */
export const SiteDataContext = createContext<SiteData>({
  viewer: null,
  csrf: "",
});

export function useSiteViewer(): SiteData {
  return useContext(SiteDataContext);
}
