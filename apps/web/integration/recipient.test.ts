import { afterEach, expect, it, vi } from "vitest";
import { Browser, workerEnv } from "./harness";

afterEach(() => vi.restoreAllMocks());
const env = {
  ...workerEnv,
  APP_ORIGIN: "https://staging.example.test",
  CARWORX_ENV: "staging",
  STAGING_APPROVED_RECIPIENTS_JSON: JSON.stringify(["approved@example.test"]),
};
for (const path of ["sign-up", "check-email", "forgot-password"]) {
  it(`staging production Worker ${path}: unapproved mail is acknowledged with zero Auth calls`, async () => {
    const browser = new Browser(env);
    await browser.send(`/auth/${path}`);
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("unexpected network"));
    const response = await browser.send(`/auth/${path}`, {
      form: {
        email: "unapproved@example.test",
        password: `Synthetic-${crypto.randomUUID()}`,
        consent: "on",
      },
    });
    expect(response.status).toBe(path === "sign-up" ? 302 : 200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(network).not.toHaveBeenCalled();
  });
  it(`staging production Worker ${path}: broken recipient policy fails recoverably`, async () => {
    const browser = new Browser({
      ...env,
      STAGING_APPROVED_RECIPIENTS_JSON: "[]",
    });
    await browser.send(`/auth/${path}`);
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("unexpected network"));
    const response = await browser.send(`/auth/${path}`, {
      form: {
        email: "approved@example.test",
        password: `Synthetic-${crypto.randomUUID()}`,
        consent: "on",
      },
    });
    expect(response.status).toBe(503);
    expect(network).not.toHaveBeenCalled();
  });
}
it("nonlocal production-shaped Worker without the dev flag returns 404", async () => {
  const browser = new Browser({ ...env, CARWORX_ENV: "production" });
  const response = await browser.send("/_dev/components");
  expect(response.status).toBe(404);
});
