import assert from "node:assert/strict";
import test from "node:test";
import { deploymentPlan } from "./deploy.js";
const options = {
  account: "a".repeat(32),
  sha: "b".repeat(40),
  domain: "auth-email.staging.carworx.app",
  origin: "https://staging.carworx.app",
};
test("owner hook deployment selects custom domain, reviewed tag and separate Worker", () => {
  const plan = deploymentPlan(options, {});
  assert.equal(plan.worker, "carworx-auth-email-staging");
  assert.ok(plan.args.includes("--domain"));
  assert.ok(plan.args.includes(options.domain));
  assert.equal(plan.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV, "false");
  assert.equal(plan.args.includes("--execute"), false);
});
test("application credentials and unsafe targets cannot select owner deployment", () => {
  for (const name of [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_API_KEY",
    "CLOUDFLARE_EMAIL",
  ])
    assert.throws(() =>
      deploymentPlan(options, { [name]: crypto.randomUUID() }),
    );
  for (const patch of [
    { account: "bad" },
    { sha: "main" },
    { domain: "carworx.app" },
    { domain: "staging.carworx.app" },
    { domain: "https://hook.example.test/path" },
    { origin: "http://localhost" },
  ])
    assert.throws(() => deploymentPlan({ ...options, ...patch }, {}));
});
