import { requireCondition } from "./contract.js";

export async function cloudflare(path, env, request = fetch) {
  requireCondition(
    /^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID ?? "") &&
      typeof env.CLOUDFLARE_API_TOKEN === "string" &&
      env.CLOUDFLARE_API_TOKEN.length > 0,
    "Owner Cloudflare credentials missing",
  );
  const response = await request(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/${path}`,
    {
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  requireCondition(response.ok, "Cloudflare metadata verification failed");
  const body = await response.json();
  requireCondition(
    body.success === true && body.result,
    "Cloudflare metadata invalid",
  );
  return body.result;
}

export function bindingCheck(settings) {
  const bindings = settings?.bindings;
  requireCondition(Array.isArray(bindings), "Worker binding metadata missing");
  for (const name of [
    "SUPABASE_PUBLISHABLE_KEY",
    "STAGING_APPROVED_RECIPIENTS_JSON",
  ])
    requireCondition(
      bindings.filter((b) => b.name === name && b.type === "secret_text")
        .length === 1,
      "Required private Worker binding missing",
    );
  return true;
}

export async function verifyOwnerTarget(
  policy,
  readiness,
  env,
  request = fetch,
) {
  requireCondition(
    readiness.account_id === env.CLOUDFLARE_ACCOUNT_ID &&
      readiness.app_origin === env.STAGING_APP_ORIGIN,
    "Owner target changed",
  );
  const token = await cloudflare("tokens/verify", env, request);
  requireCondition(
    token.id === readiness.token_id && token.status === "active",
    "Deployment token differs from reviewed scoped policy",
  );
  const settings = await cloudflare(
    `workers/scripts/${policy.worker}/settings`,
    env,
    request,
  );
  bindingCheck(settings);
  // The token must also be unable to edit the hook. Read-only metadata access to
  // it is deliberately absent; hook version verification uses an owner receipt.
  return { token_verified: true, publishable_binding_present: true };
}

export async function currentDeployment(worker, env, request = fetch) {
  const result = await cloudflare(
    `workers/scripts/${worker}/deployments`,
    env,
    request,
  );
  const latest = result.deployments?.[0];
  requireCondition(
    latest &&
      typeof latest.id === "string" &&
      Array.isArray(latest.versions) &&
      latest.versions.length === 1 &&
      latest.versions[0].percentage === 100 &&
      /^[a-f0-9-]{36}$/.test(latest.versions[0].version_id ?? ""),
    "Single current Worker deployment required",
  );
  const version = await cloudflare(
    `workers/scripts/${worker}/versions/${latest.versions[0].version_id}`,
    env,
    request,
  );
  requireCondition(
    version.annotations?.["workers/tag"] === env.REVIEWED_SHA,
    "Deployed Worker tag does not match reviewed head",
  );
  return {
    deployment_id: latest.id,
    version_id: latest.versions[0].version_id,
  };
}
