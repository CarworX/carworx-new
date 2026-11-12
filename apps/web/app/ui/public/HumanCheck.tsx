import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget (Claude 22 §4). Rendered explicitly after
 * mount, so the widget's own DOM never meets React hydration. The script
 * must come from Cloudflare's exact URL (client-side rendering docs, read
 * 2026-11-11). Inside a <form>, the widget adds the hidden
 * `cf-turnstile-response` field the server verifies.
 */
export const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(
    el: HTMLElement,
    options: { sitekey: string; action: string; size: string },
  ): string | undefined;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT}"]`,
    );
    if (!script) {
      script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error());
    });
    script.addEventListener("error", () => {
      reject(new Error());
    });
  });
}

export function HumanCheck({
  siteKey,
  action,
}: {
  siteKey: string;
  action: "enquiry" | "demand" | "support";
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let id: string | undefined;
    let cancelled = false;
    loadScript()
      .then((api) => {
        if (cancelled || !box.current) return;
        id = api.render(box.current, {
          sitekey: siteKey,
          action,
          size: "flexible",
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (id !== undefined) window.turnstile?.remove(id);
    };
  }, [siteKey, action]);
  return (
    <div className="grid gap-2">
      <div ref={box} data-human-check={action} />
      <p className="type-caption text-quiet">
        A quick check by Cloudflare stops spam. It needs JavaScript, so this
        form can't be sent with JavaScript turned off.
      </p>
    </div>
  );
}
