import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nativeMailConfig, nativeMessage } from "./mail-config.js";

const file = (name) =>
  readFileSync(new URL(`../../../supabase/${name}`, import.meta.url), "utf8");
const templates = {
  confirmation: file("templates/confirmation.html"),
  recovery: file("templates/recovery.html"),
};
const origin = "http://localhost:5173";
const token = "synthetic-token-hash";

test("native scratch config replaces unsupported file serving with a signed loopback hook", () => {
  const original = file("config.toml");
  const config = nativeMailConfig(original, "http://127.0.0.1:23456/hook");
  assert.doesNotMatch(config, /^content_path =/m);
  assert.match(config, /\[auth.hook.send_email\]\s+enabled = true/);
  assert.match(config, /secrets = "env\(LOCAL_AUTH_EMAIL_HOOK_SECRET\)"/);
  assert.throws(() => nativeMailConfig(original, "https://example.test/hook"));
  assert.throws(() => nativeMailConfig(config, "http://127.0.0.1:23456/hook"));
});

test("native messages keep confirmation and recovery template paths without forwarding user redirects", () => {
  for (const [action, type] of [
    ["signup", "email"],
    ["recovery", "recovery"],
  ]) {
    const payload = {
      user: { email: "fixture@example.test" },
      email_data: {
        email_action_type: action,
        token_hash: token,
        redirect_to: "https://invalid.example.test",
      },
    };
    const message = nativeMessage(payload, origin, templates);
    assert.match(
      message.HTML,
      new RegExp(`/auth/confirm\\?token_hash=${token}&amp;type=${type}`),
    );
    assert.doesNotMatch(message.HTML, /invalid\.example\.test/);
    assert.throws(() =>
      nativeMessage(
        { ...payload, user: { email: "fixture@example.com" } },
        origin,
        templates,
      ),
    );
  }
});
