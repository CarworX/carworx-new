import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GoogleButton } from "./GoogleButton";

// Synthetic values only. Server render: the no-JS path, before any script runs.
const OPTIONS = {
  clientId: "synthetic-client.example",
  nonce: "synthetic-nonce",
};

describe("Google button (B-11)", () => {
  it("renders the redirect button for no-JS sign-in and sign-up", () => {
    const signIn = renderToStaticMarkup(
      <GoogleButton formId="google-sign-in" options={OPTIONS} />,
    );
    expect(signIn).toContain('value="google"');
    expect(signIn).toContain("Continue with Google");
    expect(signIn).not.toContain("Use Google redirect instead");

    const signUp = renderToStaticMarkup(
      <GoogleButton formId="sign-up" options={OPTIONS} signup />,
    );
    expect(signUp).toContain("Sign up with Google");
    expect(signUp).not.toContain("Use Google redirect instead");
  });

  it("never shows the 'Use Google redirect instead' link, in any state", () => {
    const html = renderToStaticMarkup(
      <GoogleButton formId="google-sign-in" options={null} />,
    );
    expect(html).not.toContain("Use Google redirect instead");
    expect(html).not.toContain("underline");
  });

  it("is disabled, and its widget inert, until the terms box is ticked (B-10)", () => {
    const off = renderToStaticMarkup(
      <GoogleButton formId="sign-up" options={OPTIONS} signup disabled />,
    );
    expect(off).toContain("disabled");
    expect(off).toContain("inert");
    const on = renderToStaticMarkup(
      <GoogleButton formId="sign-up" options={OPTIONS} signup />,
    );
    expect(on).not.toContain("disabled");
    expect(on).not.toContain("inert");
  });
});
