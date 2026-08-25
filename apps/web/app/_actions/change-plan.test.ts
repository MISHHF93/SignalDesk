import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("@signaldesk/persistence");

import {
  checkRateLimit,
  getOrganizationSubscription,
} from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { changePlanAction, previewPlanChangeAction } from "./change-plan";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedGetOrganizationSubscription = vi.mocked(
  getOrganizationSubscription,
);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);

/**
 * Regression coverage for ADR 0062's owner/admin gate on
 * `previewPlanChangeAction`/`changePlanAction` — both share one internal
 * `resolveTargetPrice` helper that performs the actual role check, right
 * before its first persistence call, `getOrganizationSubscription`, which
 * is the checkpoint for both actions here (see cancel-subscription.test.ts
 * for the reference two-sided pattern).
 */
describe("previewPlanChangeAction — owner/admin role gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["member", "viewer"] as const)(
    "denies a %s session and performs no subscription lookup",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
        role,
        email: "member@example.com",
        isAnonymous: false,
      });

      const result = await previewPlanChangeAction("business");

      expect(result).toEqual({
        ok: false,
        error:
          "Only an owner or admin can manage this workspace's subscription.",
      });
      expect(mockedGetOrganizationSubscription).not.toHaveBeenCalled();
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

      const outcome = await previewPlanChangeAction("business").catch(
        (error: unknown) => ({ threw: error }),
      );

      expect(outcome).not.toEqual({
        ok: false,
        error:
          "Only an owner or admin can manage this workspace's subscription.",
      });
      expect(mockedGetOrganizationSubscription).toHaveBeenCalled();
    },
  );
});

/**
 * `changePlanAction` differs from every other gated action in this repo:
 * it calls `checkRateLimit` directly at its top level *before*
 * `resolveTargetPrice` ever runs its own role check, so the deny-path
 * flow still passes through a real rate-limit call on its way to the
 * denial. `checkRateLimit` must resolve to an allowed result here, or the
 * automocked default (`undefined`) makes `!rateLimit.allowed` throw
 * before the role gate is ever reached — a genuine shape difference from
 * the rest of this file's actions, not something to route around.
 */
describe("changePlanAction — owner/admin role gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it.each(["member", "viewer"] as const)(
    "denies a %s session and performs no subscription lookup",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
        role,
        email: "member@example.com",
        isAnonymous: false,
      });

      const result = await changePlanAction("business");

      expect(result).toEqual({
        error:
          "Only an owner or admin can manage this workspace's subscription.",
      });
      expect(mockedGetOrganizationSubscription).not.toHaveBeenCalled();
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

      const outcome = await changePlanAction("business").catch(
        (error: unknown) => ({ threw: error }),
      );

      expect(outcome).not.toEqual({
        error:
          "Only an owner or admin can manage this workspace's subscription.",
      });
      expect(mockedGetOrganizationSubscription).toHaveBeenCalled();
    },
  );
});
