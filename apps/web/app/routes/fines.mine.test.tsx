import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { FinesView, PaymentView } from "../fines/fine-view";
import MyFines from "./fines.mine";

type Loader = {
  csrf: string;
  view: FinesView;
  checkedAt: string | null;
  payment: { id: string; amount: string; view: PaymentView } | null;
};

const payableRow = {
  id: "GP-2026-118452",
  issuer: "Highveld Metro Traffic",
  offence: "Speeding notice",
  issued: "2026-11-15",
  amountCents: 45000,
  payCents: 45000,
  discounted: false,
  payable: true,
  reasonNotPayable: null,
};
const notPayableRow = {
  id: "GP-2026-123817",
  issuer: "Highveld Metro Traffic",
  offence: "Parking notice",
  issued: "2026-11-18",
  amountCents: 25000,
  payCents: 25000,
  discounted: false,
  payable: false,
  reasonNotPayable: "Contact the issuing authority.",
};

function render(loaderData: Partial<Loader> & Pick<Loader, "view">): string {
  const Page = MyFines as unknown as (p: {
    loaderData: unknown;
    actionData: unknown;
  }) => React.JSX.Element;
  const full: Loader = {
    csrf: "t",
    checkedAt: "2026-11-25T06:15:00Z",
    payment: null,
    ...loaderData,
  };
  const Stub = createRoutesStub([
    {
      path: "/fines/mine",
      Component: () => <Page loaderData={full} actionData={undefined} />,
    },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={["/fines/mine"]} />);
}

describe("/fines/mine", () => {
  it("none: no fines on the ID, and when it is checked again", () => {
    const html = render({ view: { kind: "none" } });
    expect(html).toContain("No fines on your ID.");
    expect(html).toContain("We check again each time you open this page.");
  });

  it("list: the amount to settle, the pay button, and the last check in SAST", () => {
    const html = render({
      view: {
        kind: "list",
        payable: [payableRow],
        notPayable: [],
        totalCents: 45000,
        checkedAt: "2026-11-25T06:15:00Z",
        onlyNotPayable: false,
      },
    });
    expect(html).toContain("To settle");
    expect(html).toContain("R 450,00");
    expect(html).toContain("Speeding notice");
    expect(html).toContain("Pay R 450,00 on a secure checkout");
    expect(html).toContain("Last checked today, 08:15 SAST.");
  });

  it("not payable here is shown apart, with the reason, and never as a checkout", () => {
    const html = render({
      view: {
        kind: "list",
        payable: [payableRow],
        notPayable: [notPayableRow],
        totalCents: 45000,
        checkedAt: "2026-11-25T06:15:00Z",
        onlyNotPayable: false,
      },
    });
    expect(html).toContain("Not payable here");
    expect(html).toContain("Contact the issuing authority.");
    expect(html).toContain('value="GP-2026-118452"');
    expect(html).not.toContain('value="GP-2026-123817"');
  });

  it("only not payable: a warning and no pay button", () => {
    const html = render({
      view: {
        kind: "list",
        payable: [],
        notPayable: [notPayableRow],
        totalCents: 0,
        checkedAt: "2026-11-25T06:15:00Z",
        onlyNotPayable: true,
      },
    });
    expect(html).toContain("1 fine, but it can&#x27;t be paid online.");
    expect(html).not.toContain("secure checkout");
  });

  it("unavailable: says the records can't be reached, not that there are none", () => {
    const html = render({ view: { kind: "unavailable" }, checkedAt: null });
    expect(html).toContain("We can&#x27;t reach the fines records right now.");
    expect(html).not.toContain("No fines on your ID.");
  });

  it("a payment waiting for the issuer is not shown as paid", () => {
    const html = render({
      view: { kind: "none" },
      payment: {
        id: "de3c1000-0000-4000-8000-000000000009",
        amount: "R 450,00",
        view: { kind: "awaiting" },
      },
    });
    expect(html).toContain("Waiting for the issuer.");
    expect(html).not.toContain("Receipt");
  });

  it("a confirmed payment shows its receipt", () => {
    const html = render({
      view: { kind: "none" },
      payment: {
        id: "de3c1000-0000-4000-8000-000000000009",
        amount: "R 450,00",
        view: { kind: "paid", receipt: "CXF-ABC12345" },
      },
    });
    expect(html).toContain("Payment confirmed by the issuer.");
    expect(html).toContain("CXF-ABC12345");
  });

  it("uses no fictional, demo, mock, sandbox or pilot wording on the page", () => {
    const text = render({
      view: {
        kind: "list",
        payable: [payableRow],
        notPayable: [],
        totalCents: 45000,
        checkedAt: "2026-11-25T06:15:00Z",
        onlyNotPayable: false,
      },
    }).toLowerCase();
    for (const word of ["fictional", "demo", "mock", "pilot"])
      expect(text).not.toContain(word);
  });
});
