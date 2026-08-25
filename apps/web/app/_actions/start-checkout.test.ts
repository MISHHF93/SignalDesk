import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("@signaldesk/persistence");

import { checkRateLimit, createDatabasePool } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { startCheckoutAction } from "./start-checkout";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCreateDatabasePool = vi.mocked(createDatabasePool);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);

/**
 * Regression coverage for ADR 0062's owner/admin gate on
 * `startCheckoutAction`. Same two-sided shape as the other billing
 * actions' role-gate tests (see cancel-subscription.test.ts). The
 * `!session` branch calls `redirect()` directly rather than returning
 * `{error}` — irrelevant here since every case below always supplies a
 * real (non-null) session, just with a role that should or shouldn't
 * pass the gate.
 */
describe("startCheckoutAction — owner/admin role gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["member", "viewer"] as const)(
    "denies a %s session and performs no rate-limit check or database lookup",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
        role,
        email: "member@example.com",
        isAnonymous: false,
      });

      const result = await startCheckoutAction(
        { error: null, clientSecret: null },
        new FormData(),
      );

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

      const outcome = await startCheckoutAction(
        { error: null, clientSecret: null },
        new FormData(),
      ).catch((error: unknown) => ({ threw: error }));

      expect(outcome).not.toEqual({
        error:
          "Only an owner or admin can manage this workspace's subscription.",
        clientSecret: null,
      });
      expect(mockedCheckRateLimit).toHaveBeenCalled();
    },
  );
});
