import { UpstreamProviderError } from "@signaldesk/integrations/shared/upstream-error";
import { describe, expect, it } from "vitest";

import { classifyRecoveryStrategy } from "./recovery-strategy";

const CONTEXT = {
  providerName: "QuickBooks",
  entityLabel: "This invoice",
  connectorSlug: "quickbooks",
};

function upstreamError(
  status: number | null,
  retryAfterSeconds: number | null = null,
): UpstreamProviderError {
  return new UpstreamProviderError(
    "QuickBooks send failed. Please try again, or reconnect this integration if the problem continues.",
    "raw detail",
    status,
    retryAfterSeconds,
  );
}

describe("classifyRecoveryStrategy", () => {
  it("classifies 401 as reauth_required, with a real reconnect slug", () => {
    const result = classifyRecoveryStrategy(upstreamError(401), CONTEXT);

    expect(result.strategy).toBe("reauth_required");
    expect(result.message).toContain("Reconnect QuickBooks");
    expect(result.reconnectSlug).toBe("quickbooks");
  });

  it("classifies 403 as reauth_required, with a real reconnect slug", () => {
    const result = classifyRecoveryStrategy(upstreamError(403), CONTEXT);

    expect(result.strategy).toBe("reauth_required");
    expect(result.reconnectSlug).toBe("quickbooks");
  });

  it("never sets a reconnect slug for a non-auth failure", () => {
    expect(
      classifyRecoveryStrategy(upstreamError(429), CONTEXT).reconnectSlug,
    ).toBeUndefined();
    expect(
      classifyRecoveryStrategy(upstreamError(409), CONTEXT).reconnectSlug,
    ).toBeUndefined();
    expect(
      classifyRecoveryStrategy(upstreamError(404), CONTEXT).reconnectSlug,
    ).toBeUndefined();
    expect(
      classifyRecoveryStrategy(upstreamError(500), CONTEXT).reconnectSlug,
    ).toBeUndefined();
  });

  it("classifies 429 as rate_limited, mentioning the provider", () => {
    const result = classifyRecoveryStrategy(upstreamError(429), CONTEXT);

    expect(result.strategy).toBe("rate_limited");
    expect(result.message).toContain("QuickBooks");
    expect(result.message).toContain("in a few minutes");
  });

  it("uses a real Retry-After value in seconds when under a minute", () => {
    const result = classifyRecoveryStrategy(upstreamError(429, 30), CONTEXT);

    expect(result.message).toContain("30 second");
  });

  it("uses a real Retry-After value in minutes when 60 seconds or more", () => {
    const result = classifyRecoveryStrategy(upstreamError(429, 125), CONTEXT);

    expect(result.message).toContain("2 minute");
  });

  it("classifies 409 as conflict, naming the entity", () => {
    const result = classifyRecoveryStrategy(upstreamError(409), CONTEXT);

    expect(result.strategy).toBe("conflict");
    expect(result.message).toContain("This invoice");
  });

  it("classifies 404 as entity_not_found, naming the entity", () => {
    const result = classifyRecoveryStrategy(upstreamError(404), CONTEXT);

    expect(result.strategy).toBe("entity_not_found");
    expect(result.message).toContain("This invoice");
    expect(result.message).toContain("could not be found");
  });

  it("falls back to unrecoverable with the original safe message for an unhandled status", () => {
    const error = upstreamError(500);
    const result = classifyRecoveryStrategy(error, CONTEXT);

    expect(result.strategy).toBe("unrecoverable");
    expect(result.message).toBe(error.message);
  });

  it("falls back to unrecoverable, never fabricating a status, when status is null", () => {
    const error = upstreamError(null);
    const result = classifyRecoveryStrategy(error, CONTEXT);

    expect(result.strategy).toBe("unrecoverable");
    expect(result.message).toBe(error.message);
  });
});
