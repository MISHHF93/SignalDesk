import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/stripe-billing");

import { checkRateLimit, createDatabasePool } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { cancelSubscriptionAction } from "./cancel-subscription";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCreateDatabasePool = vi.mocked(createDatabasePool);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);

/**
 * Regression coverage for ADR 0062's owner/admin gate on billing-mutating
 * actions. Same two-sided shape as connect-asana.test.ts/
 * disconnect-asana.test.ts: strict deny path, light-touch allow-path
 * checkpoint.
 */
describe("cancelSubscriptionAction — owner/admin role gate", () => {
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

      const result = await cancelSubscriptionAction({ error: null });

      expect(result).toEqual({
        error:
          "Only an owner or admin can manage this workspace's subscription.",
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

      const outcome = await cancelSubscriptionAction({ error: null }).catch(
        (error: unknown) => ({ threw: error }),
      );

      expect(outcome).not.toEqual({
        error:
          "Only an owner or admin can manage this workspace's subscription.",
      });
      expect(mockedCheckRateLimit).toHaveBeenCalled();
    },
  );
});
