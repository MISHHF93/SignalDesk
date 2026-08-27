import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/rate-limit");
vi.mock("../_lib/resend-config");
vi.mock("@signaldesk/integrations/resend");
vi.mock("@signaldesk/persistence");

import { sendEmail } from "@signaldesk/integrations/resend";
import { getLatestArtifact } from "@signaldesk/persistence";

import { checkRateLimit } from "../_lib/rate-limit";
import { getResendConfig } from "../_lib/resend-config";
import { getCurrentOrganization } from "../_lib/session";
import { emailDailyBriefAction } from "./email-daily-brief";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetResendConfig = vi.mocked(getResendConfig);
const mockedGetLatestArtifact = vi.mocked(getLatestArtifact);
const mockedSendEmail = vi.mocked(sendEmail);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "member",
  email: "member@example.com",
  isAnonymous: false,
};

const RESEND_CONFIG = {
  apiKey: "key-1",
  fromAddress: "brief@signaldesk.example",
};

const BRIEF = {
  id: "artifact-1",
  title: "Daily Brief — Aug 25",
  content: "Everything is fine.",
};

/**
 * A real, on-demand delivery channel — inert with an honest error until
 * both RESEND config and a real brief actually exist (see the source
 * file's own doc comment); never claims to fulfill scheduled delivery.
 */
describe("emailDailyBriefAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedGetResendConfig.mockReturnValue(RESEND_CONFIG);
    mockedGetLatestArtifact.mockResolvedValue(
      BRIEF as unknown as Awaited<ReturnType<typeof getLatestArtifact>>,
    );
    mockedSendEmail.mockResolvedValue(
      {} as Awaited<ReturnType<typeof sendEmail>>,
    );
  });

  it("returns early with no session and sends no email", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await emailDailyBriefAction();

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("refuses honestly when the session has no email (guest workspace)", async () => {
    mockedGetCurrentOrganization.mockResolvedValue({
      ...SESSION,
      email: null,
    });

    const result = await emailDailyBriefAction();

    expect(result).toEqual({
      ok: false,
      error:
        "Your account has no email address to send to (guest workspaces can't receive email).",
    });
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("refuses honestly when email delivery isn't configured for this deployment", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetResendConfig.mockReturnValue(null);

    const result = await emailDailyBriefAction();

    expect(result).toEqual({
      ok: false,
      error: "Email delivery isn't configured for this deployment yet.",
    });
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("refuses honestly when no Daily Brief has been generated yet", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetLatestArtifact.mockResolvedValue(null);

    const result = await emailDailyBriefAction();

    expect(result).toEqual({
      ok: false,
      error: "Generate a Daily Brief first, then email it.",
    });
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("regression: refuses at the rate limit — a real gap found by review since this action had no throttle at all", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 300,
    });

    const result = await emailDailyBriefAction();

    expect(result).toEqual({
      ok: false,
      error: "Please wait 5 more minute(s) before emailing the brief again.",
    });
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("sends the real most-recent brief to the signed-in user's own account email on the happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);

    const result = await emailDailyBriefAction();

    expect(result).toEqual({ ok: true, sentTo: "member@example.com" });
    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "key-1",
        from: "brief@signaldesk.example",
        to: "member@example.com",
        subject: "Daily Brief — Aug 25",
      }),
    );
  });

  it("escapes HTML-significant characters from the brief content before sending", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetLatestArtifact.mockResolvedValue({
      id: "artifact-1",
      title: "Daily Brief",
      content: `<script>alert("xss")</script> & "quoted" 'text'`,
    } as unknown as Awaited<ReturnType<typeof getLatestArtifact>>);

    await emailDailyBriefAction();

    const call = mockedSendEmail.mock.calls[0]?.[0];
    expect(call?.html).not.toContain("<script>");
    expect(call?.html).toContain("&lt;script&gt;");
    expect(call?.html).toContain("&amp;");
    expect(call?.html).toContain("&quot;quoted&quot;");
    expect(call?.html).toContain("&#39;text&#39;");
  });

  it("returns a description of the failure when sending the email throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedSendEmail.mockRejectedValue(new Error("Resend API unavailable"));

    const result = await emailDailyBriefAction();

    expect(result).toEqual({
      ok: false,
      error: "Resend API unavailable",
    });
  });
});
