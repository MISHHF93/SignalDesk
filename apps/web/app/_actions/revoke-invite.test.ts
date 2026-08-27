import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("@signaldesk/persistence");

import {
  recordAuditEvent,
  revokeOrganizationInvite,
} from "@signaldesk/persistence";

import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import { revokeInviteAction } from "./revoke-invite";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedRevokeOrganizationInvite = vi.mocked(revokeOrganizationInvite);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedRecordAuditEvent = vi.mocked(recordAuditEvent);

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
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("refuses at the rate limit", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    const result = await revokeInviteAction("invite-1");

    expect(result).toEqual({
      ok: false,
      error: "Too many requests. Try again shortly.",
    });
    expect(mockedRevokeOrganizationInvite).not.toHaveBeenCalled();
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
    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        userId: "user-1",
        eventType: "invite.revoked",
        subjectType: "organization_invite",
        subjectId: "invite-1",
        outcome: "succeeded",
        metadata: { revoked: true },
      }),
    );
  });

  it("regression: records an honest no-op, not a fabricated revocation, for an already-accepted/revoked invite — a real gap found by review since this action recorded no audit event at all", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedRevokeOrganizationInvite.mockResolvedValue(false);

    await revokeInviteAction("invite-1");

    expect(mockedRecordAuditEvent).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({ metadata: { revoked: false } }),
    );
  });

  it("returns a description of the failure when the write throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedRevokeOrganizationInvite.mockRejectedValue(
      new Error("invite not found"),
    );

    const result = await revokeInviteAction("invite-1");

    expect(result).toEqual({ ok: false, error: "invite not found" });
    expect(mockedRecordAuditEvent).not.toHaveBeenCalled();
  });
});
