import type { ReactNode } from "react";

import { CSRF_FIELD } from "../server/security/csrf";

// Plain, unstyled markup. Studio components and styles arrive with T4; these
// pages switch to them once T4 merges.

export function AuthPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main>
      <h1>{title}</h1>
      {children}
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
    <p>
      <label htmlFor="email">Email</label>
      <input
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
    <p>
      <label htmlFor={name}>{label}</label>
      <input
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
