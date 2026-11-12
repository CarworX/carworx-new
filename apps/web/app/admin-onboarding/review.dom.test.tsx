// @vitest-environment happy-dom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseDecision } from "../server/providers/forms";
import { ApplicationReview } from "./ApplicationReview";
import { ClaimReview } from "./ClaimReview";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let router: ReturnType<typeof createMemoryRouter>;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  router?.dispose();
  host.remove();
  vi.restoreAllMocks();
});

function mount(node: ReactNode) {
  router = createMemoryRouter([{ path: "/", element: node }]);
  act(() => root.render(<RouterProvider router={router} />));
}

function input(name: string, value?: string) {
  const selector = `input[name="${name}"]${value ? `[value="${value}"]` : ""}`;
  const field = host.querySelector<HTMLInputElement>(selector);
  if (!field) throw new Error(`Missing field ${selector}`);
  return field;
}

function click(control: HTMLElement) {
  act(() => control.click());
}

function next() {
  const control = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Continue",
  );
  if (!control) throw new Error("Missing Continue button");
  click(control);
}

function step() {
  return host
    .querySelector('[role="progressbar"]')
    ?.getAttribute("aria-valuenow");
}

const business = {
  display_name: "Synthetic workshop",
  description: "Synthetic business used for review tests.",
  mode: "both" as const,
  metro: "Johannesburg",
  address: "1 Synthetic Street",
};

describe("guided application review", () => {
  it("keeps checked premises evidence across all five steps and submits the existing RPC contract", () => {
    mount(<ApplicationReview csrf="test" business={business} />);
    expect(step()).toBe("1");
    next();
    next();
    expect(step()).toBe("3");
    click(input("labels", "premises_visited"));
    next();
    expect(step()).toBe("3"); // Labels cannot advance without their evidence.
    input("evidence").value = "Synthetic visit record";
    next();
    next();
    expect(step()).toBe("5");
    expect(input("review_confirmed").required).toBe(true);
    const form = host.querySelector("form");
    if (!form) throw new Error("Missing review form");
    expect(parseDecision(new FormData(form))).toMatchObject({
      p_decision: "approve",
      p_labels: ["premises_visited"],
      p_evidence: "Synthetic visit record",
    });
  });

  it("offers premises visited for fixed and both, but never for mobile-only", () => {
    mount(
      <ApplicationReview
        csrf="test"
        business={{ ...business, mode: "mobile" }}
      />,
    );
    expect(host.querySelector('[value="premises_visited"]')).toBeNull();
    expect(host.textContent).toContain("service area");
  });

  it("requires a useful send-back reason before confirmation", () => {
    mount(<ApplicationReview csrf="test" business={business} />);
    next();
    next();
    next();
    click(input("decision", "reject"));
    next();
    expect(step()).toBe("4");
    input("reason").value = "Synthetic: correct the business name";
    next();
    expect(step()).toBe("5");
    const form = host.querySelector("form");
    if (!form) throw new Error("Missing review form");
    expect(parseDecision(new FormData(form))).toMatchObject({
      p_decision: "reject",
      p_reason: "Synthetic: correct the business name",
      p_labels: [],
      p_method: null,
    });
  });
});

describe("guided claim review", () => {
  it("explains lost access and requires a rejection reason while retaining the existing intent", () => {
    mount(
      <ClaimReview
        csrf="test"
        claim={{
          claimant: "Synthetic claimant",
          listing: "Synthetic workshop",
          organisation: "Synthetic organisation",
          evidence_kind: "business_email",
          email_domain: "synthetic.example",
          document_reference: null,
          activeMembers: 3,
        }}
      />,
    );
    next();
    next();
    expect(step()).toBe("3");
    expect(host.textContent).toContain("removes everyone else");
    next();
    click(input("intent", "reject"));
    next();
    expect(step()).toBe("4");
    input("note").value = "Synthetic: evidence does not match";
    next();
    expect(step()).toBe("5");
    const form = host.querySelector("form");
    if (!form) throw new Error("Missing claim form");
    expect(new FormData(form).get("intent")).toBe("reject");
    expect(input("review_confirmed").required).toBe(true);
  });
});
