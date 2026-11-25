import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  nativeMailConfig,
  nativeMessage,
  nativeMessages,
} from "./mail-config.js";

const file = (name) =>
  readFileSync(new URL(`../../../supabase/${name}`, import.meta.url), "utf8");
const templates = {
  confirmation: file("templates/confirmation.html"),
  recovery: file("templates/recovery.html"),
  email_change: file("templates/email_change.html"),
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

test("an email change sends one link to each address, each with its own token", () => {
  const payload = {
    user: { email: "old@example.test", new_email: "new@example.test" },
    email_data: {
      email_action_type: "email_change",
      token_hash: "synthetic-token-for-new",
      token_hash_new: "synthetic-token-for-old",
      redirect_to: "https://invalid.example.test",
    },
  };
  const messages = nativeMessages(payload, origin, templates);
  assert.equal(messages.length, 2);
  assert.deepEqual(
    messages.map((m) => m.To[0].Email),
    ["old@example.test", "new@example.test"],
  );
  assert.match(
    messages[0].HTML,
    /token_hash=synthetic-token-for-old&amp;type=email_change/,
  );
  assert.match(
    messages[1].HTML,
    /token_hash=synthetic-token-for-new&amp;type=email_change/,
  );
  for (const m of messages) {
    assert.doesNotMatch(m.HTML, /invalid\.example\.test|\{\{/);
    assert.match(m.HTML, /new@example\.test/);
  }
  // Sign-up and recovery still send exactly one message.
  const signup = {
    user: { email: "fixture@example.test" },
    email_data: { email_action_type: "signup", token_hash: token },
  };
  assert.equal(nativeMessages(signup, origin, templates).length, 1);
  // Never outside the synthetic domain, never the same address twice.
  for (const user of [
    { email: "old@example.test", new_email: "someone@gmail.com" },
    { email: "old@example.test", new_email: "old@example.test" },
  ])
    assert.throws(() =>
      nativeMessages({ ...payload, user }, origin, templates),
    );
});
