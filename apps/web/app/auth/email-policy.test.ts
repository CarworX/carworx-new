import { afterEach, describe, expect, it, vi } from "vitest";
import { readServerConfig } from "../server/security/config";
import {
  approvedRecipients,
  canonicalEmail,
} from "../server/security/recipient-policy";
import { emailDecision } from "./email-policy.server";
import { action as signup } from "./routes/sign-up";
import { action as reset } from "./routes/forgot-password";
import { action as resend } from "./routes/check-email";
type ActionArgs = Parameters<typeof signup>[0] &
  Parameters<typeof reset>[0] &
  Parameters<typeof resend>[0];

const APP = "https://staging.example.test";
const env = {
  APP_ORIGIN: APP,
  SUPABASE_URL: "https://project.example.test",
  SUPABASE_PUBLISHABLE_KEY: "a".repeat(32),
  CARWORX_ENV: "staging",
  STAGING_APPROVED_RECIPIENTS_JSON: JSON.stringify([
    "Allow.Name+tag@example.test",
  ]),
};
afterEach(() => vi.restoreAllMocks());

describe("canonical recipient policy", () => {
  it("matches canonical addresses exactly without alias rewriting", () => {
    const set = approvedRecipients(env.STAGING_APPROVED_RECIPIENTS_JSON);
    expect(
      set?.has(canonicalEmail(" ALLOW.Name+tag@EXAMPLE.test ") ?? ""),
    ).toBe(true);
    for (const email of [
      "allowname+tag@example.test",
      "allow.name@example.test",
      "allow.name+tag@sub.example.test",
      "prefixallow.name+tag@example.test",
    ])
      expect(set?.has(email)).toBe(false);
  });
  it.each([
    undefined,
    "",
    "[]",
    "null",
    "{}",
    "not-json",
    JSON.stringify(["*@example.test"]),
    JSON.stringify(["valid@example.test", null]),
    JSON.stringify(["bad\r\n@example.test"]),
  ])("invalid policy denies all delivery", (value) => {
    expect(approvedRecipients(value)).toBeNull();
  });
  it("local mode requires both configured and actual origins to be loopback", () => {
    const local = readServerConfig({
      ...env,
      APP_ORIGIN: "http://localhost:5173",
      SUPABASE_URL: "http://127.0.0.1:54321",
      CARWORX_ENV: "local",
    });
    expect(
      emailDecision(new Request(local.appOrigin), local, "local@example.test"),
    ).toBe("allow");
    expect(emailDecision(new Request(APP), local, "local@example.test")).toBe(
      "unavailable",
    );
    expect(
      emailDecision(
        new Request(APP),
        readServerConfig({ ...env, CARWORX_ENV: "local" }),
        "local@example.test",
      ),
    ).toBe("unavailable");
  });
});

for (const [name, action] of [
  ["signup", signup],
  ["reset", reset],
  ["resend", resend],
] as const) {
  it(`${name}: unapproved address is acknowledged without an Auth call`, async () => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("unexpected network"));
    const request = new Request(`${APP}/auth/${name}`, {
      method: "POST",
      body: new URLSearchParams({
        email: "unapproved@example.test",
        password: "synthetic-" + crypto.randomUUID(),
        consent: "on",
      }),
    });
    const context = {
      security: { config: readServerConfig(env), csrfToken: "a".repeat(43) },
    };
    // Route-level check supplements the separately tested Worker CSRF/Origin boundary.
    const result = await action({ request, context } as ActionArgs);
    expect(network).not.toHaveBeenCalled();
    if (result instanceof Response) expect(result.status).toBe(302);
    else expect(result.data).toEqual({ outcome: "sent" });
    expect(JSON.stringify(result)).not.toContain("unapproved@example.test");
  });
  it.each(["", "[]", "broken-json"])(
    `${name}: invalid configuration produces a recoverable refusal`,
    async (policy) => {
      const network = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("unexpected network"));
      const request = new Request(APP, {
        method: "POST",
        body: new URLSearchParams({
          email: "allow.name+tag@example.test",
          password: "synthetic-" + crypto.randomUUID(),
          consent: "on",
        }),
      });
      const context = {
        security: {
          config: readServerConfig({
            ...env,
            STAGING_APPROVED_RECIPIENTS_JSON: policy,
          }),
          csrfToken: "a".repeat(43),
        },
      };
      const result = await action({ request, context } as ActionArgs);
      expect(network).not.toHaveBeenCalled();
      expect(result).toMatchObject({ init: { status: 503 } });
    },
  );
}
