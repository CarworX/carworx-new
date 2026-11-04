import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import geist from "./styles/fonts/Geist-latin.woff2?url";
import stylesheet from "./styles/app.css?url";
import { NotFound } from "./ui/states/NotFound";

// The Studio stylesheet and the self-hosted text face (G13). Geist is
// preloaded so first paint uses it and layout does not shift (A6 / CLS).
export const links: Route.LinksFunction = () => [
  {
    rel: "preload",
    href: geist,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
  { rel: "stylesheet", href: stylesheet },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-ZA">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // The D-041 404: the dot-grid lens.
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <>
        <title>Page not found · CarworX</title>
        <meta name="robots" content="noindex" />
        <NotFound />
      </>
    );
  }

  // No stack traces or error messages are rendered, in any mode.
  const details =
    isRouteErrorResponse(error) && error.statusText
      ? error.statusText
      : "An unexpected error occurred.";
  return (
    <main className="cx-canvas grid min-h-dvh place-items-center p-4 text-center">
      <div>
        <p className="cx-eyebrow">Error</p>
        <h1 className="type-heading mt-2">Something went wrong</h1>
        <p className="type-body text-muted mt-2">{details}</p>
      </div>
    </main>
  );
}
