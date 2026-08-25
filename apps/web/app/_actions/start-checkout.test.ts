import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/stripe-billing-config");
vi.mock("../_lib/error-reporter");
vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/stripe-billing");

import {
  createStripeCustomer,
  createSubscriptionWithImmediatePayment,
} from "@signaldesk/integrations/stripe-billing";
import {
  checkRateLimit,
  createDatabasePool,
  createOrganizationSubscription,
  getCurrentStandardPrice,
  getOrganizationSubscription,
  getPlanByKey,
  getRedeemablePromoPrice,
  recordAuditEvent,
  recordPromoRedemption,
  withAdvisoryLock,
} from "@signaldesk/persistence";

import { errorReporter } from "../_lib/error-reporter";
import { getCurrentOrganization } from "../_lib/session";
import {
  getStripeMode,
  getStripeSecretKey,
  isBillingConfigured,
  resolveStripePriceId,
} from "../_lib/stripe-billing-config";
import { startCheckoutAction } from "./start-checkout";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCreateDatabasePool = vi.mocked(createDatabasePool);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedWithAdvisoryLock = vi.mocked(withAdvisoryLock);
const mockedGetOrganizationSubscription = vi.mocked(
  getOrganizationSubscription,
);
const mockedGetPlanByKey = vi.mocked(getPlanByKey);
const mockedGetRedeemablePromoPrice = vi.mocked(getRedeemablePromoPrice);
const mockedGetCurrentStandardPrice = vi.mocked(getCurrentStandardPrice);
const mockedResolveStripePriceId = vi.mocked(resolveStripePriceId);
const mockedIsBillingConfigured = vi.mocked(isBillingConfigured);
const mockedGetStripeSecretKey = vi.mocked(getStripeSecretKey);
const mockedGetStripeMode = vi.mocked(getStripeMode);
const mockedCreateStripeCustomer = vi.mocked(createStripeCustomer);
const mockedCreateSubscriptionWithImmediatePayment = vi.mocked(
  createSubscriptionWithImmediatePayment,
);
const mockedCreateOrganizationSubscription = vi.mocked(
  createOrganizationSubscription,
);
const mockedRecordPromoRedemption = vi.mocked(recordPromoRedemption);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedErrorReporterCaptureException = vi.mocked(
  errorReporter.captureException,
);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
} as const;

function paidCheckoutFormData(promoKey?: string): FormData {
  const formData = new FormData();
  formData.set("planKey", "starter");
  formData.set("billingInterval", "month");
  if (promoKey) {
    formData.set("promoKey", promoKey);
  }
  return formData;
}

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

describe("startCheckoutAction — paid checkout audit trail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedIsBillingConfigured.mockReturnValue(true);
    mockedWithAdvisoryLock.mockImplementation((_db, _key, fn) => fn());
    mockedGetOrganizationSubscription.mockResolvedValue(null);
    mockedGetPlanByKey.mockResolvedValue({
      id: "plan-starter",
      planKey: "starter",
      supportsSelfServeCheckout: true,
    } as unknown as Awaited<ReturnType<typeof getPlanByKey>>);
    mockedGetCurrentStandardPrice.mockResolvedValue({
      id: "price-starter-monthly",
      planKey: "starter",
      promoKey: null,
    } as unknown as Awaited<ReturnType<typeof getCurrentStandardPrice>>);
    mockedGetRedeemablePromoPrice.mockResolvedValue({
      id: "price-starter-promo",
      planKey: "starter",
      promoKey: "LAUNCH20",
    } as unknown as Awaited<ReturnType<typeof getRedeemablePromoPrice>>);
    mockedResolveStripePriceId.mockReturnValue("price_stripe_starter_monthly");
    mockedGetStripeSecretKey.mockReturnValue("sk_test_fake");
    mockedGetStripeMode.mockReturnValue("test");
    mockedCreateStripeCustomer.mockResolvedValue({
      id: "cus_new_1",
    } as unknown as Awaited<ReturnType<typeof createStripeCustomer>>);
    mockedCreateSubscriptionWithImmediatePayment.mockResolvedValue({
      subscriptionId: "sub_new_1",
      status: "incomplete",
      clientSecret: "pi_123_secret_abc", // gitleaks:allow — fake test fixture, not a real Stripe secret
    });
    mockedCreateOrganizationSubscription.mockResolvedValue({
      id: "sub-row-1",
    } as unknown as Awaited<ReturnType<typeof createOrganizationSubscription>>);
  });

  it("records a real audit event on a successful paid checkout", async () => {
    const result = await startCheckoutAction(
      { error: null, clientSecret: null },
      paidCheckoutFormData(),
    );

    expect(result).toEqual({
      error: null,
      clientSecret: "pi_123_secret_abc", // gitleaks:allow — fake test fixture, not a real Stripe secret
    });
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "subscription.checkout_completed",
        subjectId: "sub-row-1",
        outcome: "succeeded",
        metadata: expect.objectContaining({
          planKey: "starter",
          mode: "paid",
          isResubscribing: false,
        }),
      }),
    );
  });

  it("regression: still reports the real successful checkout even when recording the promo redemption itself fails", async () => {
    // Real bug found by review: recordPromoRedemption used to be a bare
    // call inside the same try/catch whose catch returns "Checkout
    // failed" — by that point the real Stripe subscription and the local
    // organization_subscriptions row already exist, so a transient
    // failure here told the customer checkout failed entirely and
    // discarded the real clientSecret needed to confirm payment, even
    // though a live subscription genuinely exists.
    mockedRecordPromoRedemption.mockRejectedValue(
      new Error("promo_redemptions insert timed out"),
    );

    const result = await startCheckoutAction(
      { error: null, clientSecret: null },
      paidCheckoutFormData("LAUNCH20"),
    );

    expect(result).toEqual({
      error: null,
      clientSecret: "pi_123_secret_abc", // gitleaks:allow — fake test fixture, not a real Stripe secret
    });
    expect(mockedErrorReporterCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        operation: "start_checkout.record_promo_redemption",
      }),
    );
    expect(mockedRecordAuditEvent).toHaveBeenCalled();
  });
});
