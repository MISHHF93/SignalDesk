import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../_lib/session");
vi.mock("../../../_lib/rate-limit");
vi.mock("../../../_lib/error-reporter");
vi.mock("../../../_lib/stripe-billing-config");
vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/stripe-billing");

import {
  attachDefaultPaymentMethod,
  createStripeBillingClient,
  retrieveSetupIntentPaymentMethod,
} from "@signaldesk/integrations/stripe-billing";
import {
  getOrganizationSubscription,
  recordAuditEvent,
} from "@signaldesk/persistence";

import { errorReporter } from "../../../_lib/error-reporter";
import { checkRateLimit } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";
import { getStripeSecretKey } from "../../../_lib/stripe-billing-config";
import { GET } from "./route";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetOrganizationSubscription = vi.mocked(
  getOrganizationSubscription,
);
const mockedRetrieveSetupIntentPaymentMethod = vi.mocked(
  retrieveSetupIntentPaymentMethod,
);
const mockedAttachDefaultPaymentMethod = vi.mocked(attachDefaultPaymentMethod);
const mockedCreateStripeBillingClient = vi.mocked(createStripeBillingClient);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedGetStripeSecretKey = vi.mocked(getStripeSecretKey);
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

const SUBSCRIPTION = {
  id: "sub-row-1",
  organizationId: "org-1",
  stripeCustomerId: "cus_1",
  stripeSubscriptionId: "sub_stripe_1",
} as Awaited<ReturnType<typeof getOrganizationSubscription>>;

function requestWithParams(params: Record<string, string>): Request {
  const url = new URL("http://localhost/billing/payment-method/return");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url);
}

function locationOf(response: Response): string {
  return response.headers.get("location") ?? "";
}

describe("payment-method/return route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetOrganizationSubscription.mockResolvedValue(SUBSCRIPTION);
    mockedRetrieveSetupIntentPaymentMethod.mockResolvedValue("pm_1");
    mockedGetStripeSecretKey.mockReturnValue("sk_test");
    mockedCreateStripeBillingClient.mockReturnValue(
      {} as ReturnType<typeof createStripeBillingClient>,
    );
  });

  it("attaches the real payment method and redirects to the success state", async () => {
    const response = await GET(
      requestWithParams({
        setup_intent: "seti_1",
        redirect_status: "succeeded",
      }),
    );

    expect(mockedAttachDefaultPaymentMethod).toHaveBeenCalledWith(
      expect.anything(),
      {
        customerId: "cus_1",
        subscriptionId: "sub_stripe_1",
        paymentMethodId: "pm_1",
      },
    );
    expect(locationOf(response)).toContain("billing=payment_method_updated");
  });

  it("redirects to the failure state without attaching anything when Stripe's own redirect_status isn't 'succeeded'", async () => {
    const response = await GET(
      requestWithParams({ setup_intent: "seti_1", redirect_status: "failed" }),
    );

    expect(mockedAttachDefaultPaymentMethod).not.toHaveBeenCalled();
    expect(locationOf(response)).toContain("billing=payment_method_failed");
  });

  it("sends an unauthenticated visitor to sign in rather than attaching anything", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const response = await GET(
      requestWithParams({
        setup_intent: "seti_1",
        redirect_status: "succeeded",
      }),
    );

    expect(mockedAttachDefaultPaymentMethod).not.toHaveBeenCalled();
    expect(locationOf(response)).toContain("/login");
  });

  it("refuses at the rate limit without attaching anything", async () => {
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    const response = await GET(
      requestWithParams({
        setup_intent: "seti_1",
        redirect_status: "succeeded",
      }),
    );

    expect(mockedAttachDefaultPaymentMethod).not.toHaveBeenCalled();
    expect(locationOf(response)).toContain("billing=payment_method_failed");
  });

  it("regression: still redirects to the success state even when recording the audit event itself fails", async () => {
    // Real bug found by review, same shape as change-plan.ts's own
    // regression: recordAuditEvent used to be a bare call right after the
    // real Stripe attach had already succeeded — a transient failure here
    // fell into the same catch that reports payment_method_failed,
    // discarding an already-real success.
    mockedRecordAuditEvent.mockRejectedValue(
      new Error("audit_events insert timed out"),
    );

    const response = await GET(
      requestWithParams({
        setup_intent: "seti_1",
        redirect_status: "succeeded",
      }),
    );

    expect(locationOf(response)).toContain("billing=payment_method_updated");
    expect(mockedErrorReporterCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        operation: "billing_action.record_audit_event",
      }),
    );
  });

  it("redirects to the failure state when the subscription has no real Stripe customer/subscription yet", async () => {
    mockedGetOrganizationSubscription.mockResolvedValue(null);

    const response = await GET(
      requestWithParams({
        setup_intent: "seti_1",
        redirect_status: "succeeded",
      }),
    );

    expect(mockedAttachDefaultPaymentMethod).not.toHaveBeenCalled();
    expect(locationOf(response)).toContain("billing=payment_method_failed");
  });

  it("redirects to the failure state and reports the error when the real Stripe attach throws", async () => {
    mockedAttachDefaultPaymentMethod.mockRejectedValue(
      new Error("card declined"),
    );

    const response = await GET(
      requestWithParams({
        setup_intent: "seti_1",
        redirect_status: "succeeded",
      }),
    );

    expect(locationOf(response)).toContain("billing=payment_method_failed");
    expect(mockedErrorReporterCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operation: "payment_method_return.attach" }),
    );
  });
});
