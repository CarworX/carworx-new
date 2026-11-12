import { describe, expect, it } from "vitest";
import { mailtoHref } from "./mailto";

describe("reply address links", () => {
  it.each([
    "sender@example.test",
    "sender+tag@example.test",
    "?to=a%40example.test&bcc=b%40example.test&x=@example.test",
    "sender#fragment@example.test",
    "sender&cc=copy@example.test",
    "sender%0d%0abcc=copy@example.test",
  ])("keeps address %# in the address component only", (address) => {
    const url = new URL(mailtoHref(address));
    expect(url.protocol).toBe("mailto:");
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
    expect(decodeURIComponent(url.pathname)).toBe(address);
  });
});
