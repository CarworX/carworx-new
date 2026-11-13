import { describe, expect, it } from "vitest";

import { devPagesEnabled } from "../../routes/_dev.guard";
import { emailDecision } from "../../auth/email-policy.server";
import { readTurnstile, TEST_SECRET_PASS } from "../forms/turnstile";
import { ConfigError, readServerConfig } from "./config";

// Synthetic values only.
const KEY = "sb_publishable_synthetic_000000000000";
const LOCAL = {
  APP_ORIGIN: "http://localhost:5173",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_PUBLISHABLE_KEY: KEY,
};
const HOSTED = {
  APP_ORIGIN: "https://carworx.example",
  SUPABASE_URL: "https://synthetic-ref.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: KEY,
};
const PROD = { ...HOSTED, CARWORX_ENV: "production" };
const RECIPIENTS = JSON.stringify(["tester@example.test"]);

describe("readServerConfig environments (P-3)", () => {
  it("local: explicit, or inferred only when both origins are loopback", () => {
    expect(
      readServerConfig({ ...LOCAL, CARWORX_ENV: "local" }).environment,
    ).toBe("local");
    expect(readServerConfig(LOCAL).environment).toBe("local");
    expect(readServerConfig(HOSTED).environment).toBeNull();
    expect(
      readServerConfig({ ...LOCAL, SUPABASE_URL: HOSTED.SUPABASE_URL })
        .environment,
    ).toBeNull();
  });

  it("staging: recognised with its recipient list", () => {
    const config = readServerConfig({
      ...HOSTED,
      CARWORX_ENV: "staging",
      CARWORX_DEV_PAGES: "1",
      STAGING_APPROVED_RECIPIENTS_JSON: RECIPIENTS,
    });
    expect(config.environment).toBe("staging");
    expect([...(config.approvedRecipients ?? [])]).toEqual([
      "tester@example.test",
    ]);
  });

  it("production: recognised, with no recipient list", () => {
    const config = readServerConfig(PROD);
    expect(config.environment).toBe("production");
    expect(config.approvedRecipients).toBeNull();
    expect(config.appOrigin).toBe("https://carworx.example");
  });

  it("unknown or mistyped modes are null, never local or production", () => {
    for (const mode of ["Production", "prod", "", "1", 1, null]) {
      expect(
        readServerConfig({ ...HOSTED, CARWORX_ENV: mode }).environment,
      ).toBeNull();
      expect(
        readServerConfig({ ...LOCAL, CARWORX_ENV: mode }).environment,
      ).toBeNull();
    }
  });

  it.each([
    ["SUPABASE_PUBLISHABLE_KEY", { SUPABASE_PUBLISHABLE_KEY: undefined }],
    ["SUPABASE_PUBLISHABLE_KEY", { SUPABASE_PUBLISHABLE_KEY: "short" }],
    ["APP_ORIGIN", { APP_ORIGIN: undefined }],
    ["APP_ORIGIN", { APP_ORIGIN: "http://localhost:5173" }],
    ["APP_ORIGIN", { APP_ORIGIN: "https://localhost" }],
    ["APP_ORIGIN", { APP_ORIGIN: "http://carworx.example" }],
    ["APP_ORIGIN", { APP_ORIGIN: "https://carworx.example/path" }],
    ["SUPABASE_URL", { SUPABASE_URL: undefined }],
    ["SUPABASE_URL", { SUPABASE_URL: "http://127.0.0.1:54321" }],
    ["SUPABASE_URL", { SUPABASE_URL: "https://127.0.0.1" }],
  ])("production fails closed on missing or unsafe %s", (name, patch) => {
    expect(() => readServerConfig({ ...PROD, ...patch })).toThrow(
      new ConfigError(name),
    );
  });

  it.each([
    "CARWORX_DEV_PAGES",
    "STAGING_APPROVED_RECIPIENTS_JSON",
    "STAGING_PROBE_EVENT_KEY",
    "STAGING_PROBE_ORIGIN",
    "STAGING_PROBE_ADMIN_KEY",
    "LOCAL_AUTH_EMAIL_HOOK_URI",
    "LOCAL_AUTH_EMAIL_HOOK_SECRET",
  ])("production refuses the staging/local control %s", (name) => {
    expect(() => readServerConfig({ ...PROD, [name]: "1" })).toThrow(
      new ConfigError(name),
    );
    // Any value, even an empty string, means it was set.
    expect(() => readServerConfig({ ...PROD, [name]: "" })).toThrow(
      ConfigError,
    );
  });

  it("missing env fails closed in every mode", () => {
    for (const env of [undefined, null, {}, { CARWORX_ENV: "production" }]) {
      expect(() => readServerConfig(env)).toThrow(ConfigError);
    }
  });
});

describe("production never enables dev pages (P-3)", () => {
  const url = "https://carworx.example/_dev/components";
  it("stays closed even with the flag, a dev build or a loopback host", () => {
    const env = { CARWORX_ENV: "production", CARWORX_DEV_PAGES: "1" };
    expect(devPagesEnabled(new Request(url), env, false)).toBe(false);
    expect(devPagesEnabled(new Request(url), env, true)).toBe(false);
    expect(
      devPagesEnabled(
        new Request("http://localhost:8787/_dev/components"),
        { CARWORX_ENV: "production" },
        false,
      ),
    ).toBe(false);
  });
  it("staging keeps its flag behaviour", () => {
    expect(
      devPagesEnabled(
        new Request(url),
        { CARWORX_ENV: "staging", CARWORX_DEV_PAGES: "1" },
        false,
      ),
    ).toBe(true);
  });
});

describe("production downstream decisions stay closed (P-3)", () => {
  it("sends no Auth email until the P-4 sender is reviewed", () => {
    const config = readServerConfig(PROD);
    expect(
      emailDecision(
        new Request("https://carworx.example/auth/sign-up"),
        config,
        "tester@example.test",
      ),
    ).toBe("unavailable");
  });
  it("refuses Cloudflare Turnstile test secrets", () => {
    const env = {
      TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      TURNSTILE_SECRET_KEY: TEST_SECRET_PASS,
    };
    expect(readTurnstile(env, "production")).toBeUndefined();
    expect(readTurnstile(env, "staging")).toBeUndefined();
    expect(readTurnstile(env, null)).toBeUndefined();
    expect(readTurnstile(env, "local")?.testMode).toBe(true);
  });
});
