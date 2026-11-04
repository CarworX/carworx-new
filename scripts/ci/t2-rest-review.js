// Independent review probe. Local synthetic Supabase only; never prints keys.
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const raw = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const config = JSON.parse(raw.slice(raw.indexOf("{")));
const base = new URL(config.API_URL);
assert(
  ["127.0.0.1", "localhost"].includes(base.hostname),
  "Review must target a local stack",
);
assert(
  config.JWT_SECRET && config.ANON_KEY && config.SERVICE_ROLE_KEY,
  "Local fixture signing material missing",
);
const user = (n) => `5eed0000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const orgA = "5eed0000-0000-4000-8000-0000000000a1";
const orgB = "5eed0000-0000-4000-8000-0000000000b2";
const encoded = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
function token(n, aal = "aal1", metadata = {}) {
  const now = Math.floor(Date.now() / 1000);
  const body = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({ sub: user(n), role: "authenticated", aud: "authenticated", aal, iat: now, exp: now + 600, ...metadata })}`;
  return `${body}.${createHmac("sha256", config.JWT_SECRET).update(body).digest("base64url")}`;
}
let tests = 0;
async function request(jwt, path, method = "GET", body) {
  const response = await fetch(new URL(`/rest/v1/${path}`, base), {
    method,
    headers: {
      apikey: config.ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, data };
}
async function rows(jwt, path, count, label) {
  const r = await request(jwt, path);
  assert.equal(r.status, 200, `${label}: HTTP status`);
  assert(Array.isArray(r.data), `${label}: row response`);
  assert.equal(r.data.length, count, `${label}: visible rows`);
  tests++;
}
async function denied(jwt, path, method, body, label) {
  const r = await request(jwt, path, method, body);
  assert([401, 403].includes(r.status), `${label}: must be rejected`);
  tests++;
}
const staff = token(2),
  owner = token(1),
  admin1 = token(4),
  admin2 = token(4, "aal2");
for (const table of ["profiles", "organisations", "memberships", "audit_log"]) {
  await denied(
    config.ANON_KEY,
    `${table}?select=*`,
    "GET",
    undefined,
    `anon ${table}`,
  );
}
await rows(staff, `organisations?id=eq.${orgA}&select=id`, 1, "member control");
await rows(
  staff,
  `organisations?id=eq.${orgB}&select=id`,
  0,
  "cross-tenant read",
);
await rows(
  staff,
  `organisations?id=eq.${orgB}&select=id`,
  0,
  "cross-tenant before write",
);
const crossWrite = await request(
  staff,
  `organisations?id=eq.${orgB}`,
  "PATCH",
  { name: "forbidden synthetic write" },
);
assert.equal(crossWrite.status, 200, "cross-tenant update request");
assert.deepEqual(
  crossWrite.data,
  [],
  "cross-tenant update must affect zero rows",
);
tests++;
await denied(
  staff,
  "memberships",
  "POST",
  { organisation_id: orgB, user_id: user(3), role: "owner" },
  "cross-tenant insert",
);
await denied(
  owner,
  `memberships?organisation_id=eq.${orgA}&user_id=eq.${user(2)}`,
  "PATCH",
  { organisation_id: orgB },
  "membership move",
);
const own = await request(
  owner,
  `memberships?organisation_id=eq.${orgA}&user_id=eq.${user(1)}&select=id`,
);
assert.equal(own.status, 200);
assert.equal(own.data.length, 1);
await denied(
  owner,
  "memberships?on_conflict=id",
  "POST",
  {
    id: own.data[0].id,
    organisation_id: orgB,
    user_id: user(1),
    role: "owner",
  },
  "membership move upsert",
);
await rows(
  owner,
  `memberships?id=eq.${own.data[0].id}&organisation_id=eq.${orgA}&select=id`,
  1,
  "upsert preserves tenant",
);
for (const table of ["organisations", "memberships", "audit_log"])
  await rows(admin1, `${table}?select=*`, 0, `admin aal1 ${table}`);
await rows(
  admin1,
  `profiles?id=eq.${user(1)}&select=id`,
  0,
  "admin aal1 other profile",
);
await rows(admin2, "organisations?select=id", 2, "admin aal2 organisations");
await rows(
  admin2,
  `profiles?id=eq.${user(1)}&select=id`,
  1,
  "admin aal2 other profile",
);
const forged = token(3, "aal2", {
  user_metadata: { is_admin: true, role: "owner", organisation_id: orgA },
  app_metadata: { is_admin: true },
});
await rows(forged, "organisations?select=id", 0, "forged metadata");
const membershipPath = `memberships?organisation_id=eq.${orgA}&user_id=eq.${user(2)}`;
try {
  const revoked = await request(
    config.SERVICE_ROLE_KEY,
    membershipPath,
    "PATCH",
    { status: "revoked" },
  );
  assert.equal(revoked.status, 200);
  assert.equal(revoked.data.length, 1);
  await rows(staff, "organisations?select=id", 0, "same JWT after revocation");
  await rows(
    staff,
    `memberships?user_id=neq.${user(2)}&select=id`,
    0,
    "revoked co-member access",
  );
} finally {
  const restored = await request(
    config.SERVICE_ROLE_KEY,
    membershipPath,
    "PATCH",
    { status: "active" },
  );
  assert.equal(restored.status, 200, "restore synthetic membership");
}
for (const method of ["POST", "PATCH", "DELETE"]) {
  await denied(
    admin2,
    "audit_log",
    method,
    method === "POST"
      ? { action: "insert", target_table: "review", target_id: "synthetic" }
      : method === "PATCH"
        ? { details: {} }
        : undefined,
    `audit ${method}`,
  );
}
writeFileSync(
  process.env.CI_RLS_REST_REPORT,
  JSON.stringify({
    tests,
    status: "passed",
    synthetic: true,
    scope: "local PostgREST with signed fixture claims; not real Auth/MFA",
  }),
);
console.log(`Independent local PostgREST review: ${tests} passed`);
