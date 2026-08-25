import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("@signaldesk/persistence");

import { deleteAIProviderConnection } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { disconnectAIProviderAction } from "./disconnect-ai-provider";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedDeleteAIProviderConnection = vi.mocked(deleteAIProviderConnection);

/**
 * Regression coverage for ADR 0062's owner/admin gate — see
 * disconnect-asana.test.ts for the reference pattern this file replicates.
 * Unlike every connector's disconnect action, `disconnectAIProviderAction`
 * takes a plain `provider` argument (not `_prevState`), returns an
 * `{ ok, error }` shape, and has no rate limit call at all — the first
 * call after the role check is `deleteAIProviderConnection` itself.
 */
describe("disconnectAIProviderAction — owner/admin role gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["member", "viewer"] as const)(
    "denies a %s session and performs no database mutation",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
        role,
        email: "member@example.com",
        isAnonymous: false,
      });

      const result = await disconnectAIProviderAction("anthropic");

      expect(result).toEqual({
        ok: false,
        error: "Only an owner or admin can disconnect an AI provider.",
      });
      expect(mockedDeleteAIProviderConnection).not.toHaveBeenCalled();
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

      const outcome = await disconnectAIProviderAction("anthropic").catch(
        (error: unknown) => ({ threw: error }),
      );

      expect(outcome).not.toEqual({
        ok: false,
        error: "Only an owner or admin can disconnect an AI provider.",
      });
      expect(mockedDeleteAIProviderConnection).toHaveBeenCalled();
    },
  );
});
