import { SiteFooter } from "../ui/site/SiteFooter";
import { SiteHeader } from "../ui/site/SiteHeader";
import type { ReactNode } from "react";

import { CSRF_FIELD } from "../server/security/csrf";

export function AuthPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="cx-shell-top">
        <SiteHeader />
      </div>
      <AuthPanel title={title}>{children}</AuthPanel>
      <SiteFooter />
    </>
  );
}

function AuthPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="cx-canvas auth-page">
      <div className="auth-panel">
        <div className="auth-card">
          <h1>{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}

export function CsrfField({ token }: { token: string }) {
  return <input type="hidden" name={CSRF_FIELD} value={token} />;
}

export function Notice({
  tone,
  children,
}: {
  tone: "error" | "info";
  children: ReactNode;
}) {
  return (
    <p role={tone === "error" ? "alert" : "status"} data-state={tone}>
      {children}
    </p>
  );
}

export function EmailField({ defaultValue }: { defaultValue?: string }) {
  return (
    <p className="cx-field">
      <label htmlFor="email">Email</label>
      <input
        className="cx-input"
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        defaultValue={defaultValue}
      />
    </p>
  );
}

export function PasswordField({
  name = "password",
  label = "Password",
  autoComplete,
}: {
  name?: string;
  label?: string;
  autoComplete: "current-password" | "new-password";
}) {
  return (
    <p className="cx-field">
      <label htmlFor={name}>{label}</label>
      <input
        className="cx-input"
        id={name}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        minLength={autoComplete === "new-password" ? 12 : undefined}
        maxLength={128}
      />
    </p>
  );
}
