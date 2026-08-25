import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/oauth-state");
vi.mock("next/navigation");
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

import { issueOAuthState } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";
import { connectHubSpotAction } from "./connect-hubspot";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedIssueOAuthState = vi.mocked(issueOAuthState);

/**
 * Regression coverage for ADR 0062's owner/admin gate — see
 * connect-asana.test.ts for the reference pattern this file replicates.
 */
describe("connectHubSpotAction — owner/admin role gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("HUBSPOT_CLIENT_ID", "test-client-id");
    vi.stubEnv("HUBSPOT_CLIENT_SECRET", "test-client-secret");
  });

  it.each(["member", "viewer"] as const)(
    "denies a %s session and performs no OAuth redirect",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
        role,
        email: "member@example.com",
        isAnonymous: false,
      });

      const result = await connectHubSpotAction({ error: null });

      expect(result).toEqual({
        error: "Only an owner or admin can connect HubSpot.",
      });
      expect(mockedIssueOAuthState).not.toHaveBeenCalled();
    },
  );

  it.each(["owner", "admin"] as const)(
    "lets a %s session proceed past the role gate",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
        role,
        email: "owner@example.com",
        isAnonymous: false,
      });

      const outcome = await connectHubSpotAction({ error: null }).catch(
        (error: unknown) => ({ threw: error }),
      );

      expect(outcome).not.toEqual({
        error: "Only an owner or admin can connect HubSpot.",
      });
      expect(mockedIssueOAuthState).toHaveBeenCalled();
    },
  );
});
