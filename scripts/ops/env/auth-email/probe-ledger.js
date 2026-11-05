// Pure ledger contract. Runtime transport and DO integration must precede receipts.
const events = new Set([
  "app_terminal",
  "auth_attempt",
  "hook_invocation",
  "provider_attempt",
  "provider_success",
  "link_verified",
]);
export function createLedger(id, version, now = Date.now()) {
  if (!/^[a-f0-9-]{36}$/.test(id) || !/^[a-f0-9]{40}$/.test(version))
    throw new Error("Invalid probe identity");
  return { id, version, expires: now + 86400000, sealed: false, events: {} };
}
export function recordEvent(ledger, event, now = Date.now()) {
  if (ledger.sealed || now >= ledger.expires) throw new Error("Probe closed");
  if (
    !event ||
    Object.keys(event).some((k) => !["id", "kind"].includes(k)) ||
    !/^[a-f0-9-]{36}$/.test(event.id) ||
    !events.has(event.kind)
  )
    throw new Error("Invalid event");
  const existing = ledger.events[event.id];
  if (existing && existing !== event.kind) throw new Error("Conflicting retry");
  return { ...ledger, events: { ...ledger.events, [event.id]: event.kind } };
}
export function sealNegative(ledger, now = Date.now()) {
  if (ledger.sealed || now >= ledger.expires) throw new Error("Probe closed");
  const counts = Object.fromEntries(
    [...events].map((kind) => [
      kind,
      Object.values(ledger.events).filter((value) => value === kind).length,
    ]),
  );
  if (
    counts.app_terminal !== 1 ||
    counts.auth_attempt ||
    counts.provider_attempt
  )
    throw new Error("Incomplete or unsafe negative evidence");
  return {
    ledger: { ...ledger, sealed: true },
    receipt: {
      status: "passed",
      auth_calls: 0,
      provider_calls: 0,
      correlation_id: ledger.id,
    },
  };
}
