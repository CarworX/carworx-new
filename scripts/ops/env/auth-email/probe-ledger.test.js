import assert from "node:assert/strict";
import test from "node:test";
import { createLedger, recordEvent, sealNegative } from "./probe-ledger.js";
const fresh = () => createLedger(crypto.randomUUID(), "a".repeat(40), 0);
test("missing observations never become zero-call proof", () => {
  assert.throws(() => sealNegative(fresh(), 1));
});
test("terminal observations permit a sealed sanitized negative receipt", () => {
  const event = { id: crypto.randomUUID(), kind: "app_terminal" };
  const ledger = recordEvent(fresh(), event, 1);
  const retried = recordEvent(ledger, event, 2);
  const result = sealNegative(retried, 3);
  assert.equal(result.receipt.auth_calls, 0);
  assert.equal(result.receipt.provider_calls, 0);
  assert.equal(Object.keys(result.receipt).length, 4);
  assert.throws(() => recordEvent(result.ledger, event, 4));
});
test("network attempts, expired state and private/freeform fields fail proof", () => {
  const ledger = recordEvent(
    fresh(),
    { id: crypto.randomUUID(), kind: "app_terminal" },
    1,
  );
  for (const kind of ["auth_attempt", "provider_attempt"])
    assert.throws(() =>
      sealNegative(
        recordEvent(ledger, { id: crypto.randomUUID(), kind }, 2),
        3,
      ),
    );
  assert.throws(() => sealNegative(ledger, 86400000));
  assert.throws(() =>
    recordEvent(
      ledger,
      {
        id: crypto.randomUUID(),
        kind: "app_terminal",
        email: "synthetic@example.test",
      },
      2,
    ),
  );
});
