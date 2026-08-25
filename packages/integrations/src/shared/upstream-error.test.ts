import { describe, expect, it } from "vitest";

import { throwUpstreamError, UpstreamProviderError } from "./upstream-error";

function errorResponse(
  status: number,
  body: string,
  headers?: Record<string, string>,
): Response {
  return new Response(body, { status, ...(headers ? { headers } : {}) });
}

describe("throwUpstreamError", () => {
  it("captures the real HTTP status on the thrown error", async () => {
    await expect(
      throwUpstreamError("Test call", errorResponse(404, "not found")),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("never leaks the raw response body into the safe message", async () => {
    try {
      await throwUpstreamError(
        "Test call",
        errorResponse(500, "internal secret stack trace"),
      );
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(UpstreamProviderError);
      const upstreamError = error as UpstreamProviderError;
      expect(upstreamError.message).not.toContain(
        "internal secret stack trace",
      );
      expect(upstreamError.rawDetail).toContain("internal secret stack trace");
    }
  });

  it("parses a numeric Retry-After header into whole seconds", async () => {
    await expect(
      throwUpstreamError(
        "Test call",
        errorResponse(429, "rate limited", { "Retry-After": "45" }),
      ),
    ).rejects.toMatchObject({ status: 429, retryAfterSeconds: 45 });
  });

  it("returns null retryAfterSeconds when no header is present", async () => {
    await expect(
      throwUpstreamError("Test call", errorResponse(500, "error")),
    ).rejects.toMatchObject({ retryAfterSeconds: null });
  });
});

describe("UpstreamProviderError", () => {
  it("defaults retryAfterSeconds to null when not passed", () => {
    const error = new UpstreamProviderError("safe message", "raw detail", 401);

    expect(error.retryAfterSeconds).toBeNull();
    expect(error.status).toBe(401);
  });

  it("allows a null status for a provider whose API never reflects failure in HTTP status", () => {
    const error = new UpstreamProviderError("safe message", "raw detail", null);

    expect(error.status).toBeNull();
  });
});
