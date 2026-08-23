import type {
  StripeLinkedSubscription,
  UpdateSubscriptionFromStripeInput,
} from "@signaldesk/persistence";
import { describe, expect, it } from "vitest";

import { findDrift } from "./route";

const BASE_LOCAL: StripeLinkedSubscription = {
  organizationId: "org-1",
  stripeSubscriptionId: "sub_1",
  stripeCustomerId: "cus_1",
  status: "active",
  trialEndsAt: null,
  currentPeriodStart: new Date("2026-08-01T00:00:00Z"),
  currentPeriodEnd: new Date("2026-09-01T00:00:00Z"),
  cancelAtPeriodEnd: false,
  canceledAt: null,
};

const BASE_DESIRED: UpdateSubscriptionFromStripeInput = {
  status: "active",
  trialEndsAt: null,
  currentPeriodStart: BASE_LOCAL.currentPeriodStart,
  currentPeriodEnd: BASE_LOCAL.currentPeriodEnd,
  cancelAtPeriodEnd: false,
  canceledAt: null,
};

describe("findDrift", () => {
  it("reports no drift when local already matches Stripe's real state", () => {
    expect(findDrift(BASE_LOCAL, BASE_DESIRED)).toEqual([]);
  });

  it("detects a status drift (the missed-webhook case this sweep exists for)", () => {
    expect(
      findDrift(BASE_LOCAL, { ...BASE_DESIRED, status: "canceled" }),
    ).toEqual(["status"]);
  });

  it("detects cancelAtPeriodEnd flipping true, not just status", () => {
    expect(
      findDrift(BASE_LOCAL, { ...BASE_DESIRED, cancelAtPeriodEnd: true }),
    ).toEqual(["cancelAtPeriodEnd"]);
  });

  it("still detects cancelAtPeriodEnd drift when desired omits the field entirely, rather than silently comparing local against itself", () => {
    const local: StripeLinkedSubscription = {
      ...BASE_LOCAL,
      cancelAtPeriodEnd: true,
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarded to build an object without this key, not merely unread
    const { cancelAtPeriodEnd: _omitted, ...desiredWithoutField } =
      BASE_DESIRED;

    expect(findDrift(local, desiredWithoutField)).toEqual([
      "cancelAtPeriodEnd",
    ]);
  });

  it("detects multiple drifted fields at once", () => {
    expect(
      findDrift(BASE_LOCAL, {
        ...BASE_DESIRED,
        status: "past_due",
        canceledAt: new Date("2026-08-15T00:00:00Z"),
      }),
    ).toEqual(["status", "canceledAt"]);
  });
});
