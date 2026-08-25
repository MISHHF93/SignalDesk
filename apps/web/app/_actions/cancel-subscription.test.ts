import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/stripe-billing-config");
vi.mock("next/navigation");
vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/stripe-billing");

import { redirect } from "next/navigation";

import { cancelSubscriptionAtPeriodEnd } from "@signaldesk/integrations/stripe-billing";
import {
  checkRateLimit,
  createDatabasePool,
  getOrganizationSubscription,
  recordAuditEvent,
  updateSubscriptionFromStripe,
} from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { getStripeSecretKey } from "../_lib/stripe-billing-config";
import { cancelSubscriptionAction } from "./cancel-subscription";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCreateDatabasePool = vi.mocked(createDatabasePool);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetOrganizationSubscription = vi.mocked(
  getOrganizationSubscription,
);
const mockedCancelSubscriptionAtPeriodEnd = vi.mocked(
  cancelSubscriptionAtPeriodEnd,
);
const mockedUpdateSubscriptionFromStripe = vi.mocked(
  updateSubscriptionFromStripe,
);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedRedirect = vi.mocked(redirect);
const mockedGetStripeSecretKey = vi.mocked(getStripeSecretKey);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
} as const;

const SUBSCRIPTION = {
  id: "sub-row-1",
  organizationId: "org-1",
  planId: "plan-1",
  planKey: "business",
  planPriceId: "price-1",
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

describe("cancelSubscriptionAction — Stripe status handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetOrganizationSubscription.mockResolvedValue(SUBSCRIPTION);
    mockedGetStripeSecretKey.mockReturnValue("sk_test_fake");
    mockedRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("regression: writes the fresh status Stripe returns, not the stale pre-call cached status", async () => {
    // Real bug found by review: this action used to write
    // `subscription.status` (read before the Stripe call) back to the
    // local row, instead of the real status Stripe reports immediately
    // after the mutation. A concurrent webhook landing between that
    // earlier read and the Stripe call (e.g. a renewal charge failing
    // into 'past_due' right as the customer clicks "Cancel") would have
    // its correct status silently overwritten back to the stale 'active'
    // this action already had cached.
    mockedCancelSubscriptionAtPeriodEnd.mockResolvedValue({
      status: "past_due",
    });

    await cancelSubscriptionAction({ error: null }).catch(() => null);

    expect(mockedUpdateSubscriptionFromStripe).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "sub_stripe_1",
      { status: "past_due", cancelAtPeriodEnd: true },
    );
  });

  it("records a real audit event and redirects on success", async () => {
    mockedCancelSubscriptionAtPeriodEnd.mockResolvedValue({
      status: "active",
    });

    await expect(cancelSubscriptionAction({ error: null })).rejects.toThrow(
      /NEXT_REDIRECT/,
    );

    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "subscription.cancel_requested",
        outcome: "succeeded",
      }),
    );
  });

  it("blocks with no Stripe call when there's no subscription to cancel", async () => {
    mockedGetOrganizationSubscription.mockResolvedValue(null);

    const result = await cancelSubscriptionAction({ error: null });

    expect(result).toEqual({ error: "There's no subscription to cancel." });
    expect(mockedCancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled();
  });

  it("blocks with no Stripe call when already set to cancel", async () => {
    mockedGetOrganizationSubscription.mockResolvedValue({
      ...SUBSCRIPTION,
      cancelAtPeriodEnd: true,
    } as typeof SUBSCRIPTION);

    const result = await cancelSubscriptionAction({ error: null });

    expect(result).toEqual({
      error: "This subscription is already set to cancel.",
    });
    expect(mockedCancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled();
  });
});
