import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/oauth-state");
vi.mock("@signaldesk/integrations/asana");
vi.mock("next/navigation");
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

import {
  buildAsanaAuthorizationUrl,
  generatePkcePair,
} from "@signaldesk/integrations/asana";
import { redirect } from "next/navigation";

import { issueOAuthState, issuePkceVerifier } from "../_lib/oauth-state";
import { getCurrentOrganization } from "../_lib/session";
import { connectAsanaAction } from "./connect-asana";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedRedirect = vi.mocked(redirect);
const mockedBuildAuthorizationUrl = vi.mocked(buildAsanaAuthorizationUrl);
const mockedGeneratePkcePair = vi.mocked(generatePkcePair);
const mockedIssueOAuthState = vi.mocked(issueOAuthState);
const mockedIssuePkceVerifier = vi.mocked(issuePkceVerifier);

/**
 * Regression coverage for ADR 0062's owner/admin gate — this repo's
 * Server Actions had no unit test coverage at all before this, so this is
 * the reference pattern the same check is verified against across every
 * gated connect/disconnect/billing action: a member/viewer session must
 * be rejected with the exact stated error, and — the property that
 * actually matters — must never reach any real side-effecting call.
 */
describe("connectAsanaAction — owner/admin role gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ASANA_CLIENT_ID", "test-client-id");
    vi.stubEnv("ASANA_CLIENT_SECRET", "test-client-secret");
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

      const result = await connectAsanaAction({ error: null });

      expect(result).toEqual({
        error: "Only an owner or admin can connect Asana.",
      });
      expect(mockedRedirect).not.toHaveBeenCalled();
      expect(mockedBuildAuthorizationUrl).not.toHaveBeenCalled();
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
      mockedIssueOAuthState.mockResolvedValue("test-state");
      mockedIssuePkceVerifier.mockResolvedValue(undefined);
      mockedGeneratePkcePair.mockReturnValue({
        verifier: "test-verifier",
        challenge: "test-challenge",
      });
      mockedBuildAuthorizationUrl.mockReturnValue(
        "https://app.asana.com/-/oauth_authorize?state=test",
      );
      mockedRedirect.mockImplementation(() => {
        throw new Error("NEXT_REDIRECT");
      });

      await expect(connectAsanaAction({ error: null })).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(mockedRedirect).toHaveBeenCalledWith(
        "https://app.asana.com/-/oauth_authorize?state=test",
      );
    },
  );
});
