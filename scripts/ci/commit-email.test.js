import assert from "node:assert/strict";
import { test } from "node:test";

import { allowed, offenders } from "./commit-email.js";

test("noreply addresses pass", () => {
  for (const email of [
    "86560354+Gerrard-Lewu@users.noreply.github.com",
    "noreply@github.com",
    "noreply@anthropic.com",
  ])
    assert.equal(allowed(email), true, email);
});

test("personal and lookalike addresses fail", () => {
  for (const email of [
    "someone@gmail.com",
    "owner@example.com",
    "noreply@anthropic.com.evil.test",
    "x@users.noreply.github.com.evil.test",
    "",
  ])
    assert.equal(allowed(email), false, email);
});

test("offenders lists short SHAs only, never addresses", () => {
  const sha = "a".repeat(40);
  const good = "b".repeat(40);
  const bad = offenders([
    `${sha}\tsomeone@gmail.com\tnoreply@github.com`,
    `${good}\tnoreply@anthropic.com\tnoreply@github.com`,
  ]);
  assert.deepEqual(bad, ["aaaaaaa"]);
});
