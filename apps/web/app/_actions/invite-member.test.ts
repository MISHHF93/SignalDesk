import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/request-origin");
vi.mock("../_lib/resend-config");
vi.mock("@signaldesk/persistence");
vi.mock("@signaldesk/integrations/resend");

import { sendEmail } from "@signaldesk/integrations/resend";
import { createOrganizationInvite } from "@signaldesk/persistence";

import { checkRateLimit } from "../_lib/rate-limit";
import { getRequestOrigin } from "../_lib/request-origin";
import { getResendConfig } from "../_lib/resend-config";
import { getCurrentOrganization } from "../_lib/session";
import { inviteMemberAction } from "./invite-member";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetRequestOrigin = vi.mocked(getRequestOrigin);
const mockedGetResendConfig = vi.mocked(getResendConfig);
const mockedCreateOrganizationInvite = vi.mocked(createOrganizationInvite);
const mockedSendEmail = vi.mocked(sendEmail);

const OWNER_SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
};

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

/**
 * Real behavioral coverage for team invitations, including the one
 * honesty-discipline property CLAUDE.md itself calls out: this action
 * must never claim an invite email was sent unless it actually was —
 * when Resend isn't configured, the invite is still real, but the
 * accept link comes back in the message for manual sharing instead of
 * a fabricated "sent" state.
 */
describe("inviteMemberAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetRequestOrigin.mockResolvedValue("https://app.example.com");
    mockedCreateOrganizationInvite.mockResolvedValue({
      token: "invite-token-1",
    } as Awaited<ReturnType<typeof createOrganizationInvite>>);
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await inviteMemberAction(
      { error: null, message: null },
      formData({ email: "a@example.com", role: "member" }),
    );

    expect(result).toEqual({ error: "Sign in to do this.", message: null });
    expect(mockedCreateOrganizationInvite).not.toHaveBeenCalled();
  });

  it.each(["member", "viewer"] as const)(
    "denies a %s session",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue({
        ...OWNER_SESSION,
        role,
      });

      const result = await inviteMemberAction(
        { error: null, message: null },
        formData({ email: "a@example.com", role: "member" }),
      );

      expect(result).toEqual({
        error: "Only an owner or admin can invite a teammate.",
        message: null,
      });
      expect(mockedCreateOrganizationInvite).not.toHaveBeenCalled();
    },
  );

  it("refuses at the rate limit", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    const result = await inviteMemberAction(
      { error: null, message: null },
      formData({ email: "a@example.com", role: "member" }),
    );

    expect(result).toEqual({
      error: "Too many invites sent. Try again shortly.",
      message: null,
    });
  });

  it("rejects a malformed email without creating an invite", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);

    const result = await inviteMemberAction(
      { error: null, message: null },
      formData({ email: "not-an-email", role: "member" }),
    );

    expect(result).toEqual({
      error: "Enter a real email address.",
      message: null,
    });
    expect(mockedCreateOrganizationInvite).not.toHaveBeenCalled();
  });

  it("rejects an invalid role without creating an invite", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);

    const result = await inviteMemberAction(
      { error: null, message: null },
      formData({ email: "a@example.com", role: "owner" }),
    );

    expect(result).toEqual({ error: "Choose a valid role.", message: null });
    expect(mockedCreateOrganizationInvite).not.toHaveBeenCalled();
  });

  it("creates a real invite and returns the accept link for manual sharing when email delivery isn't configured — never claiming it was sent", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedGetResendConfig.mockReturnValue(null);

    const result = await inviteMemberAction(
      { error: null, message: null },
      formData({ email: "teammate@example.com", role: "member" }),
    );

    expect(mockedCreateOrganizationInvite).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      { email: "teammate@example.com", role: "member" },
    );
    expect(result.error).toBeNull();
    expect(result.message).toContain(
      "https://app.example.com/signup?invite=invite-token-1",
    );
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("sends a real invite email and confirms it was sent when Resend is configured", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedGetResendConfig.mockReturnValue({
      apiKey: "re_test",
      fromAddress: "noreply@example.com",
    } as ReturnType<typeof getResendConfig>);

    const result = await inviteMemberAction(
      { error: null, message: null },
      formData({ email: "teammate@example.com", role: "member" }),
    );

    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "teammate@example.com",
        subject: "You're invited to join a SignalDesk workspace",
      }),
    );
    expect(result).toEqual({
      error: null,
      message: "Invite sent to teammate@example.com.",
    });
  });

  it("returns a description of the failure when invite creation throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(OWNER_SESSION);
    mockedCreateOrganizationInvite.mockRejectedValue(
      new Error("duplicate pending invite"),
    );

    const result = await inviteMemberAction(
      { error: null, message: null },
      formData({ email: "teammate@example.com", role: "member" }),
    );

    expect(result).toEqual({
      error: "duplicate pending invite",
      message: null,
    });
  });
});
