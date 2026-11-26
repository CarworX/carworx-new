import { describe, expect, it } from "vitest";

import type { Fine } from "../server/fines/adapter";
import {
  fineById,
  finesView,
  paymentView,
  rand,
  shortDate,
  sastTime,
  type LookupResult,
} from "./fine-view";

const payable: Fine = {
  id: "GP-2026-118452",
  issuer: "Highveld Metro Traffic",
  offence: "Speeding notice",
  issuedAt: "2026-11-15",
  cents: 45000,
  payable: true,
};
const notPayable: Fine = {
  id: "GP-2026-123817",
  issuer: "Highveld Metro Traffic",
  offence: "Parking notice",
  issuedAt: "2026-11-18",
  cents: 25000,
  payable: false,
  reasonNotPayable: "Contact the issuing authority.",
};
const checked = "2026-11-25T06:15:00Z";
const ok = (fines: Fine[]): LookupResult => ({
  checkedAt: checked,
  coverage: [],
  fines,
});

describe("finesView", () => {
  it("unavailable when the lookup could not be read", () => {
    expect(finesView("unavailable")).toEqual({ kind: "unavailable" });
  });

  it("none when there are no fines on the ID", () => {
    expect(finesView(ok([]))).toEqual({ kind: "none" });
  });

  it("lists payable and not payable fines, and totals the payable ones", () => {
    const view = finesView(ok([payable, notPayable]));
    expect(view.kind).toBe("list");
    if (view.kind !== "list") return;
    expect(view.payable.map((r) => r.id)).toEqual([payable.id]);
    expect(view.notPayable.map((r) => r.id)).toEqual([notPayable.id]);
    expect(view.totalCents).toBe(45000);
    expect(view.onlyNotPayable).toBe(false);
    expect(view.checkedAt).toBe(checked);
  });

  it("flags a list with nothing payable here", () => {
    const view = finesView(ok([notPayable]));
    expect(view.kind === "list" && view.onlyNotPayable).toBe(true);
  });

  it("pays the discounted amount only while the discount runs", () => {
    const running: Fine = {
      ...payable,
      discountedCents: 22500,
      discountUntil: "2999-12-02T00:00:00Z",
    };
    const ended: Fine = {
      ...payable,
      discountedCents: 22500,
      discountUntil: "2000-01-01T00:00:00Z",
    };
    const a = finesView(ok([running]));
    const b = finesView(ok([ended]));
    expect(a.kind === "list" && a.totalCents).toBe(22500);
    expect(b.kind === "list" && b.totalCents).toBe(45000);
  });
});

describe("fineById", () => {
  it("finds a fine on the ID, and nothing else", () => {
    expect(fineById(ok([payable]), payable.id)?.amountCents).toBe(45000);
    expect(fineById(ok([payable]), "GP-0000-000000")).toBeNull();
    expect(fineById("unavailable", payable.id)).toBeNull();
  });
});

describe("dates and money", () => {
  it("short SAST dates from the notice date", () => {
    expect(shortDate("2026-11-15")).toBe("15 Nov");
  });

  it("SAST time of day", () => {
    expect(sastTime("2026-11-25T06:15:00Z")).toBe("08:15");
  });

  it("rand from cents", () => {
    expect(rand(45000)).toBe("R 450,00");
    expect(rand(0)).toBe("R 0,00");
  });
});

describe("paymentView", () => {
  it("paid only with a receipt, and only when the issuer has confirmed it", () => {
    expect(paymentView("paid", "CXF-ABC12345")).toEqual({
      kind: "paid",
      receipt: "CXF-ABC12345",
    });
    expect(paymentView("paid", null)).toEqual({
      kind: "stopped",
      text: "No payment was confirmed.",
    });
  });

  it("waits while the payment or the issuer is pending", () => {
    expect(paymentView("created", null)).toEqual({ kind: "awaiting" });
    expect(paymentView("pending_issuer", null)).toEqual({ kind: "awaiting" });
  });

  it("says so when a checkout was cancelled or failed", () => {
    expect(paymentView("cancelled", null)).toEqual({
      kind: "stopped",
      text: "The checkout was cancelled. No payment was made.",
    });
    expect(paymentView("failed", null)).toEqual({
      kind: "stopped",
      text: "No payment was confirmed.",
    });
  });
});
