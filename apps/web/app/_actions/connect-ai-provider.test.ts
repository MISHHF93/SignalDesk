import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("@signaldesk/persistence");

import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import { connectAIProviderAction } from "./connect-ai-provider";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);

/**
 * Regression coverage for ADR 0062's owner/admin gate — see
 * connect-asana.test.ts for the reference pattern this file replicates.
 * `connectAIProviderAction` has no `is<X>Configured()` gate (unlike every
 * OAuth connector) and imports `checkRateLimit` from `../_lib/rate-limit`
 * directly, called immediately after the role check — same checkpoint
 * shape as the billing actions.
 */
describe("connectAIProviderAction — owner/admin role gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["member", "viewer"] as const)(
    "denies a %s session and performs no rate-limit check",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
        role,
        email: "member@example.com",
        isAnonymous: false,
      });

      const result = await connectAIProviderAction(
        { error: null, message: null },
        new FormData(),
      );

      expect(result).toEqual({
        error: "Only an owner or admin can connect an AI provider.",
        message: null,
      });
      expect(mockedCheckRateLimit).not.toHaveBeenCalled();
    },
  );

  it.each(["owner", "admin"] as const)(
    "does not deny a %s session at the role gate",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
        role,
        email: "owner@example.com",
        isAnonymous: false,
      });

      const outcome = await connectAIProviderAction(
        { error: null, message: null },
        new FormData(),
      ).catch((error: unknown) => ({ threw: error }));

      expect(outcome).not.toEqual({
        error: "Only an owner or admin can connect an AI provider.",
        message: null,
      });
      expect(mockedCheckRateLimit).toHaveBeenCalled();
    },
  );
});
