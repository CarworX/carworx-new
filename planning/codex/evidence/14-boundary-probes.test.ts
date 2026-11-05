import { expect, it } from "vitest";
import {
  checkMutation,
  MAX_FORM_BYTES,
} from "../../../apps/web/app/server/security/boundary";
const origin = "http://localhost:5173";
const config = {
  appOrigin: origin,
  supabaseUrl: "http://127.0.0.1:54321",
  supabasePublishableKey: "a".repeat(32),
};
const token = "A".repeat(43);
it("accepts a valid multipart body with its original mixed-case boundary", async () => {
  const boundary = "----WebKitFormBoundaryAbCdEf123456";
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="csrf"\r\n\r\n${token}\r\n--${boundary}--\r\n`;
  const request = new Request(origin, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      Cookie: `__Host-cx-csrf=${token}`,
    },
    body,
  });
  expect(await checkMutation(request, config)).toEqual({ ok: true });
});
it("stops reading an unknown-length body once it exceeds the 64 KB limit", async () => {
  let bytes = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (bytes >= 1024 * 1024) {
        controller.close();
        return;
      }
      const chunk = new Uint8Array(16 * 1024).fill(65);
      bytes += chunk.length;
      controller.enqueue(chunk);
    },
  });
  const request = new Request(origin, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: `__Host-cx-csrf=${token}`,
    },
    body: stream,
    duplex: "half",
  } as RequestInit);
  expect(await checkMutation(request, config)).toEqual({
    ok: false,
    reason: "too-large",
  });
  expect(bytes).toBeLessThanOrEqual(MAX_FORM_BYTES + 3 * 16 * 1024);
});
