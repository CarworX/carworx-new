import { describe, expect, it } from "vitest";

import {
  MAX_BYTES,
  MAX_PIXELS,
  MAX_SIDE,
  MAX_UPLOAD_REQUEST,
  uploadTooLarge,
} from "./limits";
import * as image from "./image";

const request = (length: string | null) =>
  new Request("https://app.test/upload", {
    method: "POST",
    headers: length === null ? {} : { "Content-Length": length },
  });

describe("photo upload limits (owner 2026-11-25)", () => {
  it("are the ones the image cleaner and the database use", () => {
    expect(MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(MAX_SIDE).toBe(6000);
    expect(MAX_PIXELS).toBe(40_000_000);
    expect(image.MAX_BYTES).toBe(MAX_BYTES);
    expect(image.MAX_SIDE).toBe(MAX_SIDE);
    expect(image.MAX_PIXELS).toBe(MAX_PIXELS);
  });

  it("refuses a request that is too big, unstated or garbled, before it is read", () => {
    expect(uploadTooLarge(request(String(MAX_UPLOAD_REQUEST)))).toBe(false);
    expect(uploadTooLarge(request("1024"))).toBe(false);
    expect(uploadTooLarge(request(String(MAX_UPLOAD_REQUEST + 1)))).toBe(true);
    expect(uploadTooLarge(request(null))).toBe(true);
    expect(uploadTooLarge(request("-1"))).toBe(true);
    expect(uploadTooLarge(request("1e9"))).toBe(true);
    expect(uploadTooLarge(request("99999999999999"))).toBe(true);
  });
});
