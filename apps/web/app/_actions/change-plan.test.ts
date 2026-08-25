import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/stripe-billing-config");
vi.mock("next/navigation");
vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/stripe-billing");

import { redirect } from "next/navigation";

import {
  getSubscriptionItemId,
  updateSubscriptionPrice,
} from "@signaldesk/integrations/stripe-billing";
import {
  checkRateLimit,
  getCurrentStandardPrice,
  getOrganizationSubscription,
  getPlanByKey,
  getPlanPriceById,
  recordAuditEvent,
  updateSubscriptionFromStripe,
  withAdvisoryLock,
} from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import {
  getStripeSecretKey,
  resolveStripePriceId,
} from "../_lib/stripe-billing-config";
import { changePlanAction, previewPlanChangeAction } from "./change-plan";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedGetOrganizationSubscription = vi.mocked(
  getOrganizationSubscription,
);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedWithAdvisoryLock = vi.mocked(withAdvisoryLock);
const mockedGetPlanByKey = vi.mocked(getPlanByKey);
const mockedGetCurrentStandardPrice = vi.mocked(getCurrentStandardPrice);
const mockedGetPlanPriceById = vi.mocked(getPlanPriceById);
const mockedResolveStripePriceId = vi.mocked(resolveStripePriceId);
const mockedGetStripeSecretKey = vi.mocked(getStripeSecretKey);
const mockedGetSubscriptionItemId = vi.mocked(getSubscriptionItemId);
const mockedUpdateSubscriptionPrice = vi.mocked(updateSubscriptionPrice);
const mockedUpdateSubscriptionFromStripe = vi.mocked(
  updateSubscriptionFromStripe,
);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedRedirect = vi.mocked(redirect);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
} as const;

const CURRENT_SUBSCRIPTION = {
  id: "sub-row-1",
  organizationId: "org-1",
  planId: "plan-starter",
  planKey: "starter",
  planPriceId: "price-starter-monthly",
  status: "active",
  stripeCustomerId: "cus_1",
  stripeSubscriptionId: "sub_stripe_1",
  stripeMode: "live",
  trialEndsAt: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  canceledAt: null,
} as unknown as Awaited<ReturnType<typeof getOrganizationSubscription>>;

const TARGET_PLAN = {
  id: "plan-business",
  planKey: "business",
  name: "Business",
  supportsSelfServeCheckout: true,
} as unknown as Awaited<ReturnType<typeof getPlanByKey>>;

const TARGET_PRICE = {
  id: "price-business-monthly",
  billingInterval: "month",
} as unknown as Awaited<ReturnType<typeof getCurrentStandardPrice>>;

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
 *
 * `withAdvisoryLock` needs a real, callback-invoking mock here too (the
 * automocked default returns `undefined` without ever calling its
 * callback) — `resolveTargetPrice`'s own role check now runs *inside*
 * that lock (a real fix, not a test-only wrinkle: the lock must cover the
 * "is this already the current plan" read through the actual Stripe
 * mutation for it to close the double-submit race it exists to prevent —
 * see `changePlanAction`'s own doc comment).
 */
describe("changePlanAction — owner/admin role gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedWithAdvisoryLock.mockImplementation((_db, _key, fn) => fn());
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

describe("changePlanAction — double-submit protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetOrganizationSubscription.mockResolvedValue(CURRENT_SUBSCRIPTION);
    mockedGetPlanPriceById.mockResolvedValue({
      id: "price-starter-monthly",
      billingInterval: "month",
    } as unknown as Awaited<ReturnType<typeof getPlanPriceById>>);
    mockedGetPlanByKey.mockResolvedValue(TARGET_PLAN);
    mockedGetCurrentStandardPrice.mockResolvedValue(TARGET_PRICE);
    mockedResolveStripePriceId.mockReturnValue("price_stripe_business_monthly");
    mockedGetStripeSecretKey.mockReturnValue("sk_test_fake");
    mockedGetSubscriptionItemId.mockResolvedValue("si_123");
    mockedUpdateSubscriptionPrice.mockResolvedValue({ status: "active" });
    mockedRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    mockedWithAdvisoryLock.mockImplementation((_db, _key, fn) => fn());
  });

  it("performs the real plan change and redirects on the happy path", async () => {
    await expect(changePlanAction("business")).rejects.toThrow(/NEXT_REDIRECT/);

    expect(mockedUpdateSubscriptionPrice).toHaveBeenCalledWith(undefined, {
      subscriptionId: "sub_stripe_1",
      subscriptionItemId: "si_123",
      newPriceId: "price_stripe_business_monthly",
    });
    expect(mockedUpdateSubscriptionFromStripe).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "sub_stripe_1",
      {
        status: "active",
        planId: "plan-business",
        planPriceId: "price-business-monthly",
      },
    );
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({ eventType: "subscription.plan_changed" }),
    );
  });

  it("regression: a real advisory lock guards the read-check-then-write sequence, not just the mutation call", async () => {
    // Real bug found by review: this action used to have no advisory
    // lock at all, unlike start-checkout.ts and manage-addon.ts, which
    // both use one specifically to prevent a double-click/retry double
    // charge. Two concurrent calls could both pass "you're not already
    // on this plan" before either wrote, and Stripe would generate a
    // separate proration invoice item for each — a real double charge
    // for one logical plan change.
    expect(mockedWithAdvisoryLock).not.toHaveBeenCalled();

    await changePlanAction("business").catch(() => null);

    expect(mockedWithAdvisoryLock).toHaveBeenCalledWith(
      undefined,
      "change-plan-lock:org-1",
      expect.any(Function),
    );
  });

  it("regression: reports a clean 'already in progress' error and makes no Stripe call when the lock is already held", async () => {
    mockedWithAdvisoryLock.mockResolvedValue(null);

    const result = await changePlanAction("business");

    expect(result).toEqual({
      error:
        "Another plan change is already in progress. Please wait a moment and try again.",
    });
    expect(mockedGetSubscriptionItemId).not.toHaveBeenCalled();
    expect(mockedUpdateSubscriptionPrice).not.toHaveBeenCalled();
  });
});
