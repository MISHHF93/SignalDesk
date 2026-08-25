import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("@signaldesk/persistence");

import { revokeOrganizationInvite } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { revokeInviteAction } from "./revoke-invite";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedRevokeOrganizationInvite = vi.mocked(revokeOrganizationInvite);

const OWNER_SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
};

describe("revokeInviteAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await revokeInviteAction("invite-1");

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedRevokeOrganizationInvite).not.toHaveBeenCalled();
  });

  it.each(["member", "viewer"] as const)(
    "denies a %s session",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue({
        ...OWNER_SESSION,
        role,
      });

      const result = await revokeInviteAction("invite-1");

      expect(result).toEqual({
        ok: false,
        error: "Only an owner or admin can revoke an invite.",
      });
      expect(mockedRevokeOrganizationInvite).not.toHaveBeenCalled();
    },
  );

  it("revokes the invite on the happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedRevokeOrganizationInvite.mockResolvedValue(true);

    const result = await revokeInviteAction("invite-1");

    expect(result).toEqual({ ok: true });
    expect(mockedRevokeOrganizationInvite).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "invite-1",
    );
  });

  it("returns a description of the failure when the write throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedRevokeOrganizationInvite.mockRejectedValue(
      new Error("invite not found"),
    );

    const result = await revokeInviteAction("invite-1");

    expect(result).toEqual({ ok: false, error: "invite not found" });
  });
});
