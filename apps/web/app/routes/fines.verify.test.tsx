import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { IdentityView } from "../fines/identity-view";
import VerifyFines from "./fines.verify";

function render(
  view: IdentityView,
  extra: { firstName?: string | null; problem?: string } = {},
): string {
  const Page = VerifyFines as unknown as (p: {
    loaderData: unknown;
    actionData: unknown;
  }) => React.JSX.Element;
  const Stub = createRoutesStub([
    {
      path: "/fines/verify",
      Component: () => (
        <Page
          loaderData={{
            csrf: "t",
            view,
            firstName: extra.firstName ?? null,
          }}
          actionData={extra.problem ? { problem: extra.problem } : undefined}
        />
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={["/fines/verify"]} />);
}

describe("/fines/verify", () => {
  it("intro: the start button is there and waits for the consent box", () => {
    const html = render({ kind: "intro" });
    expect(html).toContain("Confirm it&#x27;s you.");
    expect(html).toContain("Start verification");
    expect(html).toContain('name="consent"');
    expect(html).toContain("Tick the box above to continue.");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("checking: names the person when it knows the first name, and says the page can be left", () => {
    const html = render({ kind: "checking" }, { firstName: "Thandi" });
    expect(html).toContain("Checking…");
    expect(html).toContain("Thanks, Thandi.");
    expect(html).toContain("we&#x27;ll email you when it&#x27;s done.");
  });

  it("approved: says so and links to the fines", () => {
    const html = render({ kind: "approved" });
    expect(html).toContain("You&#x27;re verified.");
    expect(html).toContain('href="/fines/mine"');
  });

  it("in review: says a person is checking it", () => {
    expect(render({ kind: "in_review" })).toContain("A person is checking it.");
  });

  it("declined with tries left: the reason, the tries meter, and try again", () => {
    const html = render({
      kind: "declined",
      reason: "The selfie didn't match the photo on your ID.",
      used: 1,
      left: 2,
    });
    expect(html).toContain("We couldn&#x27;t confirm your ID.");
    expect(html).toContain(
      "The selfie didn&#x27;t match the photo on your ID.",
    );
    expect(html).toContain("Try 1 of 3 used · 2 left");
    expect(html).toContain("Try again");
  });

  it("locked: no tries left, the reason, and the way forward", () => {
    const html = render({
      kind: "locked",
      reason: "The ID photo was too blurry or dark to read.",
    });
    expect(html).toContain("after 3 tries.");
    expect(html).toContain("3 of 3 tries used");
    expect(html).toContain('href="/support"');
  });

  it("shows the consent message when the start was sent without the box", () => {
    expect(render({ kind: "intro" }, { problem: "consent" })).toContain(
      "Tick the box to continue.",
    );
  });

  it("uses no fictional, demo, mock, sandbox or pilot wording", () => {
    for (const view of [
      { kind: "intro" },
      { kind: "checking" },
      { kind: "approved" },
      { kind: "in_review" },
      { kind: "locked", reason: "x" },
    ] as IdentityView[]) {
      const text = render(view).toLowerCase();
      for (const word of ["fictional", "demo", "mock", "sandbox", "pilot"])
        expect(text).not.toContain(word);
    }
  });
});
