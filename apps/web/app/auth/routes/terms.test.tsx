import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import Terms from "./terms";

function render(
  loaderData: { csrf: string; returnTo: string },
  actionData?: { problem: string },
): string {
  const Page = Terms as unknown as (p: {
    loaderData: unknown;
    actionData: unknown;
  }) => React.JSX.Element;
  const Stub = createRoutesStub([
    {
      path: "/auth/terms",
      Component: () => <Page loaderData={loaderData} actionData={actionData} />,
    },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={["/auth/terms"]} />);
}

describe("/auth/terms", () => {
  it("offers accept and decline, both posting the csrf token and returnTo", () => {
    const html = render({ csrf: "tok-1", returnTo: "/provider" });
    expect(html).toMatch(/<button[^>]*value="accept"[^>]*name="intent"/);
    expect(html).toContain("Accept and continue");
    expect(html).toMatch(/<button[^>]*value="decline"[^>]*name="intent"/);
    expect(html).toContain("Decline and close my account");
    expect(html.match(/name="returnTo" value="\/provider"/g)).toHaveLength(2);
    expect(html.match(/value="tok-1"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("links the terms and the privacy notice", () => {
    const html = render({ csrf: "t", returnTo: "" });
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
  });

  it("shows the accept problem when the RPC refuses", () => {
    const html = render({ csrf: "t", returnTo: "" }, { problem: "accept" });
    expect(html).toContain("We couldn&#x27;t record that. Try again.");
  });

  it("shows the support message when a decline is refused (an older account)", () => {
    const html = render({ csrf: "t", returnTo: "" }, { problem: "decline" });
    expect(html).toContain("Contact support to close your account.");
    expect(html).not.toContain("We couldn");
  });

  it("uses no pilot, demo or sandbox wording", () => {
    const text = render({ csrf: "t", returnTo: "" }).toLowerCase();
    for (const word of ["pilot", "demo", "sandbox", "mock", "fictional"])
      expect(text).not.toContain(word);
  });
});
