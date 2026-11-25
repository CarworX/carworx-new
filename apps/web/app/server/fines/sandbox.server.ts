export type Scenario = "sample" | "empty" | "unavailable";
export type Outcome = "confirmed" | "pending" | "cancelled" | "timeout";

export interface Fine {
  id: string;
  issuer: string;
  offence: string;
  cents: number;
  payable: boolean;
}

interface FinesProvider {
  lookup(
    scenario: Scenario,
  ): { checkedAt: string; fines: readonly Fine[] } | null;
  checkout(notice: string): Fine | undefined;
}

const fines: readonly Fine[] = [
  {
    id: "DEMO-101",
    issuer: "Example municipal authority",
    offence: "Speeding notice",
    cents: 45000,
    payable: true,
  },
  {
    id: "DEMO-102",
    issuer: "Example municipal authority",
    offence: "Parking notice",
    cents: 25000,
    payable: false,
  },
];

export const sandbox: FinesProvider = {
  lookup(scenario) {
    if (scenario === "unavailable") return null;
    return {
      checkedAt: new Date().toISOString(),
      fines: scenario === "empty" ? [] : fines,
    };
  },
  checkout(notice) {
    return fines.find((fine) => fine.id === notice && fine.payable);
  },
};

export function parseScenario(value: string | null): Scenario {
  return value === "empty" || value === "unavailable" ? value : "sample";
}

export function parseOutcome(value: FormDataEntryValue | null): Outcome | null {
  switch (value) {
    case "confirmed":
    case "pending":
    case "cancelled":
    case "timeout":
      return value;
    default:
      return null;
  }
}

export function settleSandbox(
  previous: Outcome | null,
  outcome: Outcome,
): Outcome {
  // Once issued, a receipt is stable even if checkout is submitted again.
  if (previous === "confirmed" || previous === "pending") return previous;
  return outcome;
}
