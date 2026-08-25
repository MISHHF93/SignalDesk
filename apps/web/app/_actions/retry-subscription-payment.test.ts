import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("@signaldesk/persistence");

import { checkRateLimit, createDatabasePool } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { retryPaymentAction } from "./retry-subscription-payment";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCreateDatabasePool = vi.mocked(createDatabasePool);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);

/**
 * Regression coverage for ADR 0062's owner/admin gate on billing-mutating
 * actions — see cancel-subscription.test.ts for the reference pattern
 * this file replicates. `retryPaymentAction` takes no arguments at all.
 */
describe("retryPaymentAction — owner/admin role gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["member", "viewer"] as const)(
    "denies a %s session and performs no database lookup",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
        role,
        email: "member@example.com",
        isAnonymous: false,
      });

      const result = await retryPaymentAction();

      expect(result).toEqual({
        error:
          "Only an owner or admin can manage this workspace's subscription.",
        clientSecret: null,
      });
      expect(mockedCreateDatabasePool).not.toHaveBeenCalled();
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

      const outcome = await retryPaymentAction().catch((error: unknown) => ({
        threw: error,
      }));

      expect(outcome).not.toEqual({
        error:
          "Only an owner or admin can manage this workspace's subscription.",
        clientSecret: null,
      });
      expect(mockedCheckRateLimit).toHaveBeenCalled();
    },
  );
});
