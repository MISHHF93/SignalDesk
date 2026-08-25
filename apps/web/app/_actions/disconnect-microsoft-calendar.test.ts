import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("@signaldesk/persistence");

import {
  createDatabasePool,
  getMicrosoftCalendarIntegrationStatus,
} from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { disconnectMicrosoftCalendarAction } from "./disconnect-microsoft-calendar";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCreateDatabasePool = vi.mocked(createDatabasePool);
const mockedGetMicrosoftCalendarIntegrationStatus = vi.mocked(
  getMicrosoftCalendarIntegrationStatus,
);

/**
 * Regression coverage for ADR 0062's owner/admin gate — see
 * disconnect-asana.test.ts for the reference pattern this file replicates.
 */
describe("disconnectMicrosoftCalendarAction — owner/admin role gate", () => {
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

      const result = await disconnectMicrosoftCalendarAction({
        error: null,
      });

      expect(result).toEqual({
        error: "Only an owner or admin can manage this connection.",
      });
      expect(mockedCreateDatabasePool).not.toHaveBeenCalled();
      expect(
        mockedGetMicrosoftCalendarIntegrationStatus,
      ).not.toHaveBeenCalled();
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

      const outcome = await disconnectMicrosoftCalendarAction({
        error: null,
      }).catch((error: unknown) => ({ threw: error }));

      expect(outcome).not.toEqual({
        error: "Only an owner or admin can manage this connection.",
      });
      expect(mockedGetMicrosoftCalendarIntegrationStatus).toHaveBeenCalled();
    },
  );
});
