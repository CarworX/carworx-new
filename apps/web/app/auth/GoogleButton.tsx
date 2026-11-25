import { useEffect, useRef, useState } from "react";

interface Identity {
  initialize(options: {
    client_id: string;
    nonce: string;
    callback: (response: { credential: string }) => void;
    context: "signin" | "signup";
    ux_mode: "popup";
    use_fedcm_for_button: boolean;
  }): void;
  renderButton(
    element: HTMLElement,
    options: {
      type: "standard";
      size: "large";
      shape: "pill";
      theme: "outline";
      text: "continue_with" | "signup_with";
      logo_alignment: "left";
      width: number;
    },
  ): void;
}

function googleIdentity() {
  return (window as Window & { google?: { accounts?: { id?: Identity } } })
    .google?.accounts?.id;
}

let script: Promise<void> | undefined;
function loadScript() {
  if (googleIdentity()) return Promise.resolve();
  if (script) return script;
  const tag = document.createElement("script");
  tag.src = "https://accounts.google.com/gsi/client";
  tag.async = true;
  script = new Promise<void>((resolve, reject) => {
    tag.onload = () => {
      resolve();
    };
    tag.onerror = () => {
      tag.remove();
      script = undefined;
      reject(new Error("Google button unavailable"));
    };
  });
  document.head.appendChild(tag);
  return script;
}

export function GoogleButton({
  formId,
  options,
  signup = false,
  requireConsent = signup,
  disabled = false,
}: {
  formId: string;
  options: { clientId: string; nonce: string } | null;
  signup?: boolean;
  /** The terms box must be ticked before Google sign-in (B-10). Sign-up always. */
  requireConsent?: boolean;
  /** Off until the terms box is ticked (B-10). */
  disabled?: boolean;
}) {
  const widget = useRef<HTMLDivElement>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [message, setMessage] = useState("");
  const clientId = options?.clientId;
  const nonce = options?.nonce;

  useEffect(() => {
    const container = widget.current;
    if (!clientId || !nonce || !container) return;
    let active = true;
    const observer = new MutationObserver(() => {
      if (container.querySelector("iframe")) setEnhanced(true);
    });
    observer.observe(container, { childList: true, subtree: true });
    void loadScript()
      .then(() => {
        const api = googleIdentity();
        if (!active || !api) return;
        api.initialize({
          client_id: clientId,
          nonce,
          context: signup ? "signup" : "signin",
          ux_mode: "popup",
          use_fedcm_for_button: true,
          callback({ credential }) {
            if (!active) return;
            const form = document.getElementById(formId);
            if (!(form instanceof HTMLFormElement)) return;
            const consent = form.elements.namedItem("consent");
            if (
              requireConsent &&
              (!(consent instanceof HTMLInputElement) || !consent.checked)
            ) {
              setMessage(
                signup
                  ? "Agree to the terms and privacy notice before signing up with Google. Then try again."
                  : "Agree to the terms and privacy notice before signing in with Google. Then try again.",
              );
              if (consent instanceof HTMLInputElement) consent.focus();
              return;
            }
            const token = form.elements.namedItem("googleCredential");
            const submit = form.querySelector<HTMLButtonElement>(
              '[value="google-id"]',
            );
            if (token instanceof HTMLInputElement && submit) {
              token.value = credential;
              form.requestSubmit(submit);
            }
          },
        });
        api.renderButton(container, {
          type: "standard",
          size: "large",
          shape: "pill",
          theme: "outline",
          text: signup ? "signup_with" : "continue_with",
          logo_alignment: "left",
          width: Math.min(
            400,
            Math.floor(container.getBoundingClientRect().width),
          ),
        });
      })
      .catch(() => {
        /* native redirect remains available */
      });
    return () => {
      active = false;
      observer.disconnect();
      container.replaceChildren();
    };
  }, [clientId, nonce, formId, signup, requireConsent]);

  return (
    <div className="grid gap-2">
      <div ref={widget} inert={disabled || undefined} />
      <input type="hidden" name="googleCredential" />
      <button
        type="submit"
        name="intent"
        value="google-id"
        formNoValidate
        hidden
      />
      {/* The redirect button is the no-JS path and the fallback when the Google
          widget can't load. Once the widget is on the page it is hidden: no
          second Google button, and no "redirect instead" link (B-11). */}
      <button
        className="cx-btn outlined wide"
        type="submit"
        name="intent"
        value="google"
        formNoValidate
        hidden={enhanced}
        disabled={disabled}
        style={enhanced ? { display: "none" } : undefined}
      >
        <img width="18" height="18" src="/assets/core/google-g.svg" alt="" />
        {signup ? "Sign up with Google" : "Continue with Google"}
      </button>
      {message && <p role="alert">{message}</p>}
    </div>
  );
}
