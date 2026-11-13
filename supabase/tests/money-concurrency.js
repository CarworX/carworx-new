// A21/A24: real concurrent PostgreSQL sessions. Only a fresh disposable local
// stack may run this fixture; callers must destroy that stack afterwards.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

assert.equal(process.env.P3_DISPOSABLE_STACK, "1");
const db = new URL(process.env.RLS_DB_URL);
assert.equal(db.protocol, "postgresql:");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(db.hostname));
assert.ok(Number(db.port) >= 20000 && Number(db.port) <= 32767);

function sql(input) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1", db.href], {
      stdio: "pipe",
    });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
    });
    // Never echo database URLs or raw SQL errors into public test reports.
    child.stderr.resume();
    child.once("error", () =>
      reject(Error("Local concurrency process unavailable")),
    );
    child.once("close", (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(Error("Local concurrency SQL failed")),
    );
    child.stdin.end("set statement_timeout='15s';\n" + input);
  });
}
const fixture = readFileSync(
  new URL("./database/60_p3_money.test.sql", import.meta.url),
  "utf8",
)
  .split("create temporary table money_first")[0]
  .replace("select plan(30);", "");
await sql(fixture + "\ncommit;");
const hold = "ad210000-0000-4000-8000-000000000008";
const customer = "ad210000-0000-4000-8000-000000000001";
const prepare = `select private.prepare_payment('${hold}','${customer}')`;
const initialisations = await Promise.all(
  Array.from({ length: 12 }, () => sql(prepare)),
);
const attempts = initialisations.map((raw) => JSON.parse(raw));
assert.equal(attempts.filter((a) => a.dispatch).length, 1);
assert.equal(new Set(attempts.map((a) => a.reference)).size, 1);
assert.equal(new Set(attempts.map((a) => a.id)).size, 1);
console.log(
  "PASS A21: 12 concurrent initialisations create one attempt and one dispatch",
);
const { reference, id } = attempts[0];
assert.match(reference, /^cx_[a-f0-9]{32}$/);
assert.match(id, /^[a-f0-9-]{36}$/);
const enqueue = `select private.enqueue_payment_event(repeat('a',64),'${reference}','charge.success','123',12500,'ZAR','success');`;
await Promise.all(Array.from({ length: 12 }, () => sql(enqueue)));
assert.equal(
  await sql(
    "select count(*) from private.payment_inbox where event_key=repeat('a',64);",
  ),
  "1",
);
const apply = `begin;
do $$declare s jsonb; begin
 s:=private.stage_verified_charge(repeat('a',64),'${reference}','123',12500,'ZAR');
 if (s->>'duplicate')::boolean then perform private.ack_duplicate_payment(repeat('a',64));
 else perform private.finish_charge_effect(repeat('a',64),'${id}','123',private.confirm_paid('${hold}','${id}')); end if;
end $$;
commit;`;
await Promise.all(Array.from({ length: 12 }, () => sql(apply)));
assert.equal(
  await sql(
    `select count(*) from private.payment_effects where attempt_id='${id}';`,
  ),
  "1",
);
assert.equal(
  await sql(
    "select count(*) from private.payment_event where booking_id='ad210000-0000-4000-8000-000000000007' and kind='paid';",
  ),
  "1",
);
assert.equal(
  await sql(
    "select state from public.bookings where id='ad210000-0000-4000-8000-000000000007';",
  ),
  "confirmed",
);
console.log(
  "PASS A24: 12 concurrent receptions and effects confirm the booking once",
);
