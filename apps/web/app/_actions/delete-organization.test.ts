import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/asana-config");
vi.mock("../_lib/quickbooks-config");
vi.mock("../_lib/stripe-config");
vi.mock("../_lib/xero-config");
vi.mock("../_lib/stripe-billing-config");
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/navigation");
vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/asana");
vi.mock("@signaldesk/integrations/gmail");
vi.mock("@signaldesk/integrations/google-calendar");
vi.mock("@signaldesk/integrations/hubspot");
vi.mock("@signaldesk/integrations/linear");
vi.mock("@signaldesk/integrations/quickbooks");
vi.mock("@signaldesk/integrations/salesforce");
vi.mock("@signaldesk/integrations/slack");
vi.mock("@signaldesk/integrations/stripe");
vi.mock("@signaldesk/integrations/stripe-billing");
vi.mock("@signaldesk/integrations/xero");
vi.mock("@signaldesk/integrations/zendesk");

import { redirect } from "next/navigation";

import { revokeHubSpotRefreshToken } from "@signaldesk/integrations/hubspot";
import { revokeQuickBooksToken } from "@signaldesk/integrations/quickbooks";
import { revokeSlackToken } from "@signaldesk/integrations/slack";
import {
  cancelSubscriptionAtPeriodEnd,
  createStripeBillingClient,
} from "@signaldesk/integrations/stripe-billing";
import {
  disconnectHubSpotIntegration,
  disconnectQuickBooksIntegration,
  disconnectSlackIntegration,
  getHubSpotTokens,
  getOrganizationSubscription,
  getQuickBooksTokens,
  getSlackTokens,
  listConnectorConnections,
  recordAuditEvent,
  anonymizeOrganization,
} from "@signaldesk/persistence";

import { isQuickBooksConfigured } from "../_lib/quickbooks-config";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import { deleteOrganizationAction } from "./delete-organization";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedListConnectorConnections = vi.mocked(listConnectorConnections);
const mockedGetOrganizationSubscription = vi.mocked(
  getOrganizationSubscription,
);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);
const mockedAnonymizeOrganization = vi.mocked(anonymizeOrganization);
const mockedGetHubSpotTokens = vi.mocked(getHubSpotTokens);
const mockedRevokeHubSpotRefreshToken = vi.mocked(revokeHubSpotRefreshToken);
const mockedDisconnectHubSpotIntegration = vi.mocked(
  disconnectHubSpotIntegration,
);
const mockedGetSlackTokens = vi.mocked(getSlackTokens);
const mockedRevokeSlackToken = vi.mocked(revokeSlackToken);
const mockedDisconnectSlackIntegration = vi.mocked(disconnectSlackIntegration);
const mockedIsQuickBooksConfigured = vi.mocked(isQuickBooksConfigured);
const mockedGetQuickBooksTokens = vi.mocked(getQuickBooksTokens);
const mockedRevokeQuickBooksToken = vi.mocked(revokeQuickBooksToken);
const mockedDisconnectQuickBooksIntegration = vi.mocked(
  disconnectQuickBooksIntegration,
);
const mockedCreateStripeBillingClient = vi.mocked(createStripeBillingClient);
const mockedCancelSubscriptionAtPeriodEnd = vi.mocked(
  cancelSubscriptionAtPeriodEnd,
);
const mockedRedirect = vi.mocked(redirect);

const OWNER_SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
};

function makeConnection(
  sourceSystem: string,
  id = `${sourceSystem}-integration`,
) {
  return {
    id,
    organizationId: "org-1",
    sourceSystem,
    externalAccountId: `${sourceSystem}-account`,
    externalAccountLabel: null,
    status: "active",
    credential: {},
    enabledCapabilityIds: [],
  } as unknown as Awaited<ReturnType<typeof listConnectorConnections>>[number];
}

/**
 * Real behavioral coverage for the single most destructive, irreversible
 * action in this app. Distinctive properties worth verifying beyond the
 * mechanical role-gate pattern used elsewhere: this is the one action
 * requiring `owner` specifically (every other gated action in this repo
 * accepts `owner` OR `admin`); a failed or throwing remote-revocation
 * attempt for one connector must never block that connector's local
 * disconnect, nor block any other connector's own cascade; and the audit
 * event recording which integrations were disconnected must be written
 * before the organization is anonymized, not after.
 */
describe("deleteOrganizationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedListConnectorConnections.mockResolvedValue([]);
    mockedGetOrganizationSubscription.mockResolvedValue(null);
    mockedIsQuickBooksConfigured.mockReturnValue(true);
    mockedRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await deleteOrganizationAction({ error: null });

    expect(result).toEqual({ error: "Sign in to do this." });
    expect(mockedListConnectorConnections).not.toHaveBeenCalled();
  });

  it.each(["admin", "member", "viewer"] as const)(
    "denies a %s session — unlike every other gated action, this one requires owner specifically",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue({
        ...OWNER_SESSION,
        role,
      });

      const result = await deleteOrganizationAction({ error: null });

      expect(result).toEqual({
        error: "Only the owner can delete this organization.",
      });
      expect(mockedListConnectorConnections).not.toHaveBeenCalled();
    },
  );

  it("refuses at the rate limit", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    const result = await deleteOrganizationAction({ error: null });

    expect(result).toEqual({ error: "Too many attempts. Try again shortly." });
    expect(mockedListConnectorConnections).not.toHaveBeenCalled();
  });

  it("disconnects every active integration and cascades to anonymization on the happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedListConnectorConnections.mockResolvedValue([
      makeConnection("hubspot"),
      makeConnection("slack"),
    ]);
    mockedGetHubSpotTokens.mockResolvedValue({
      accessToken: "hs-access",
      refreshToken: "hs-refresh",
    } as Awaited<ReturnType<typeof getHubSpotTokens>>);
    mockedRevokeHubSpotRefreshToken.mockResolvedValue(true);
    mockedGetSlackTokens.mockResolvedValue({
      accessToken: "slack-access",
    } as Awaited<ReturnType<typeof getSlackTokens>>);
    mockedRevokeSlackToken.mockResolvedValue(true);

    await expect(deleteOrganizationAction({ error: null })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mockedDisconnectHubSpotIntegration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "hubspot-integration",
    );
    expect(mockedDisconnectSlackIntegration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "slack-integration",
    );
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        eventType: "organization.deleted",
        outcome: "succeeded",
        metadata: expect.objectContaining({
          disconnectedIntegrations: ["hubspot", "slack"],
        }),
      }),
    );
    expect(mockedAnonymizeOrganization).toHaveBeenCalledWith(
      undefined,
      "org-1",
    );
  });

  it("records the audit event before anonymizing, and still disconnects every integration even when one connector's remote revocation throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedListConnectorConnections.mockResolvedValue([
      makeConnection("hubspot"),
      makeConnection("slack"),
    ]);
    // hubspot's remote revocation throws outright...
    mockedGetHubSpotTokens.mockRejectedValue(new Error("vault read failed"));
    // ...but slack's own revocation still runs and succeeds independently.
    mockedGetSlackTokens.mockResolvedValue({
      accessToken: "slack-access",
    } as Awaited<ReturnType<typeof getSlackTokens>>);
    mockedRevokeSlackToken.mockResolvedValue(true);

    const callOrder: string[] = [];
    mockedRecordAuditEvent.mockImplementation(async () => {
      callOrder.push("audit");
    });
    mockedAnonymizeOrganization.mockImplementation(async () => {
      callOrder.push("anonymize");
    });

    await expect(deleteOrganizationAction({ error: null })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    // A throwing revoke for hubspot must not prevent hubspot's own local
    // disconnect, nor block slack's independent cascade.
    expect(mockedDisconnectHubSpotIntegration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "hubspot-integration",
    );
    expect(mockedDisconnectSlackIntegration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "slack-integration",
    );
    expect(callOrder).toEqual(["audit", "anonymize"]);
  });

  it("gates a QuickBooks remote revocation attempt behind isQuickBooksConfigured", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedListConnectorConnections.mockResolvedValue([
      makeConnection("quickbooks"),
    ]);
    mockedIsQuickBooksConfigured.mockReturnValue(false);

    await expect(deleteOrganizationAction({ error: null })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mockedGetQuickBooksTokens).not.toHaveBeenCalled();
    expect(mockedRevokeQuickBooksToken).not.toHaveBeenCalled();
    // Local disconnect still runs even though remote revocation was skipped.
    expect(mockedDisconnectQuickBooksIntegration).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "quickbooks-integration",
    );
  });

  it("cancels an active Stripe subscription at period end before anonymizing", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedGetOrganizationSubscription.mockResolvedValue({
      stripeSubscriptionId: "sub_123",
      cancelAtPeriodEnd: false,
      status: "active",
    } as Awaited<ReturnType<typeof getOrganizationSubscription>>);
    mockedCreateStripeBillingClient.mockReturnValue(
      {} as ReturnType<typeof createStripeBillingClient>,
    );

    await expect(deleteOrganizationAction({ error: null })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mockedCancelSubscriptionAtPeriodEnd).toHaveBeenCalledWith(
      {},
      "sub_123",
    );
  });

  it.each([
    [
      "already scheduled to cancel",
      { cancelAtPeriodEnd: true, status: "active" },
    ],
    ["already canceled", { cancelAtPeriodEnd: false, status: "canceled" }],
    [
      "already expired",
      { cancelAtPeriodEnd: false, status: "incomplete_expired" },
    ],
  ] as const)(
    "does not attempt to cancel a subscription that is %s",
    async (_label, overrides) => {
      mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
      mockedGetOrganizationSubscription.mockResolvedValue({
        stripeSubscriptionId: "sub_123",
        ...overrides,
      } as Awaited<ReturnType<typeof getOrganizationSubscription>>);

      await expect(deleteOrganizationAction({ error: null })).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(mockedCancelSubscriptionAtPeriodEnd).not.toHaveBeenCalled();
    },
  );

  it("returns a description of the failure and never anonymizes when a top-level step throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedListConnectorConnections.mockRejectedValue(
      new Error("connection lookup failed"),
    );

    const result = await deleteOrganizationAction({ error: null });

    expect(result).toEqual({ error: "connection lookup failed" });
    expect(mockedAnonymizeOrganization).not.toHaveBeenCalled();
    expect(mockedRecordAuditEvent).not.toHaveBeenCalled();
  });
});
