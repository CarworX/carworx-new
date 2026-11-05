import assert from "node:assert/strict";
import test from "node:test";
import {
  bindingCheck,
  currentDeployment,
  verifyOwnerTarget,
} from "./hosted.js";

const env = {
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  CLOUDFLARE_API_TOKEN: crypto.randomUUID(),
  STAGING_APP_ORIGIN: "https://staging.example.test",
  REVIEWED_SHA: "b".repeat(40),
};
const settings = {
  bindings: [
    "SUPABASE_PUBLISHABLE_KEY",
    "STAGING_APPROVED_RECIPIENTS_JSON",
  ].map((name) => ({ name, type: "secret_text" })),
};
const readiness = {
  account_id: env.CLOUDFLARE_ACCOUNT_ID,
  app_origin: env.STAGING_APP_ORIGIN,
  token_id: "token-0001",
};
const response = (result) => Response.json({ success: true, result });
test("binding verification returns a Boolean and never requires secret values", () => {
  assert.equal(bindingCheck(settings), true);
  for (const bindings of [
    [],
    [{ name: "SUPABASE_PUBLISHABLE_KEY", type: "plain_text" }],
  ])
    assert.throws(() => bindingCheck({ bindings }));
});
test("live token identity must match independently reviewed scoped policy", async () => {
  const request = async (url) =>
    response(
      url.endsWith("tokens/verify")
        ? { id: readiness.token_id, status: "active" }
        : settings,
    );
  assert.equal(
    (
      await verifyOwnerTarget(
        { worker: "carworx-web-staging" },
        readiness,
        env,
        request,
      )
    ).token_verified,
    true,
  );
  await assert.rejects(
    verifyOwnerTarget(
      { worker: "carworx-web-staging" },
      { ...readiness, token_id: "changed-token" },
      env,
      request,
    ),
  );
  await assert.rejects(
    verifyOwnerTarget(
      { worker: "carworx-web-staging" },
      readiness,
      { ...env, STAGING_APP_ORIGIN: "https://elsewhere.example.test" },
      request,
    ),
  );
});
test("deployment evidence rejects split traffic and stale source tags", async () => {
  const version_id = "12345678-1234-1234-1234-123456789012";
  const request = async (url) =>
    response(
      url.endsWith("/deployments")
        ? {
            deployments: [
              {
                id: "deployment-0001",
                versions: [{ version_id, percentage: 100 }],
              },
            ],
          }
        : { annotations: { "workers/tag": env.REVIEWED_SHA } },
    );
  assert.equal(
    (await currentDeployment("carworx-web-staging", env, request)).version_id,
    version_id,
  );
  await assert.rejects(
    currentDeployment(
      "carworx-web-staging",
      { ...env, REVIEWED_SHA: "c".repeat(40) },
      request,
    ),
  );
  await assert.rejects(
    currentDeployment("carworx-web-staging", env, async () =>
      response({
        deployments: [{ id: "x", versions: [{ version_id, percentage: 50 }] }],
      }),
    ),
  );
});
