import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockHeaders = new Headers();

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => mockHeaders),
}));

import { getRequestOrigin } from "./request-origin";

const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

describe("getRequestOrigin", () => {
  beforeEach(() => {
    mockHeaders = new Headers();
  });

  afterEach(() => {
    if (ORIGINAL_APP_URL === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
    }
  });

  it("builds an origin from host + x-forwarded-proto when no app URL is configured", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    mockHeaders.set("host", "app.example.com");
    mockHeaders.set("x-forwarded-proto", "https");

    await expect(getRequestOrigin()).resolves.toBe("https://app.example.com");
  });

  it("defaults to http for a local dev host, never validating against a configured URL", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    mockHeaders.set("host", "localhost:3100");

    await expect(getRequestOrigin()).resolves.toBe("http://localhost:3100");
  });

  it("trusts the host header when it matches the configured production origin", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    mockHeaders.set("host", "app.example.com");
    mockHeaders.set("x-forwarded-proto", "https");

    await expect(getRequestOrigin()).resolves.toBe("https://app.example.com");
  });

  it("rejects a spoofed host header, using the configured origin instead (host-header-injection defense)", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    mockHeaders.set("host", "evil.example.com");
    mockHeaders.set("x-forwarded-proto", "https");

    await expect(getRequestOrigin()).resolves.toBe("https://app.example.com");
  });

  it("strips a trailing slash from the configured app URL", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";
    mockHeaders.set("host", "evil.example.com");

    await expect(getRequestOrigin()).resolves.toBe("https://app.example.com");
  });

  it("falls back to the header-based origin when the configured app URL is malformed", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "not a url";
    mockHeaders.set("host", "app.example.com");
    mockHeaders.set("x-forwarded-proto", "https");

    await expect(getRequestOrigin()).resolves.toBe("https://app.example.com");
  });

  it("defaults to localhost:3000 when no host header is present at all", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    await expect(getRequestOrigin()).resolves.toBe("http://localhost:3000");
  });
});
