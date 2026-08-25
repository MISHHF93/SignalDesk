import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/asana");

import {
  createDatabasePool,
  getAsanaIntegrationStatus,
} from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { disconnectAsanaAction } from "./disconnect-asana";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCreateDatabasePool = vi.mocked(createDatabasePool);
const mockedGetAsanaIntegrationStatus = vi.mocked(getAsanaIntegrationStatus);

/**
 * Regression coverage for ADR 0062's owner/admin gate on connector
 * disconnect actions. Same two-sided shape as `connect-asana.test.ts`:
 * the deny path is asserted strictly (exact error, zero downstream
 * calls — the actual security property); the allow path only proves the
 * gate itself doesn't block a legitimate session (a downstream lookup
 * fires), tolerating an unrelated throw from intentionally minimal
 * mocking beyond that checkpoint — the rest of the action's own
 * behavior is covered elsewhere (live verification, this session's own
 * ADR 0056/0057 work), not this file's job to re-prove.
 */
describe("disconnectAsanaAction — owner/admin role gate", () => {
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

      const result = await disconnectAsanaAction({ error: null });

      expect(result).toEqual({
        error: "Only an owner or admin can manage this connection.",
      });
      expect(mockedCreateDatabasePool).not.toHaveBeenCalled();
      expect(mockedGetAsanaIntegrationStatus).not.toHaveBeenCalled();
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

      const outcome = await disconnectAsanaAction({ error: null }).catch(
        (error: unknown) => ({ threw: error }),
      );

      expect(outcome).not.toEqual({
        error: "Only an owner or admin can manage this connection.",
      });
      expect(mockedGetAsanaIntegrationStatus).toHaveBeenCalled();
    },
  );
});
