import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("@signaldesk/persistence");

import { updateOrganizationBusinessProfile } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { updateBusinessProfileAction } from "./update-business-profile";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedUpdateOrganizationBusinessProfile = vi.mocked(
  updateOrganizationBusinessProfile,
);

function sessionWithRole(role: string) {
  return {
    organizationId: "org-1",
    userId: "user-1",
    role,
    email: "owner@example.com",
    isAnonymous: false,
  };
}

function formData(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        data.append(key, entry);
      }
    } else {
      data.set(key, value);
    }
  }
  return data;
}

/**
 * Uses the real Zod schema (updateBusinessProfileInputSchema), not a
 * mock — validation (e.g. a real IANA timezone) is itself part of the
 * guarantee under test. This action is owner-ONLY — a real, narrower gate
 * than ADR 0062's owner-or-admin connector gate (today's identity model
 * has exactly one owner per organization, per the source file's own doc
 * comment), so unlike disconnect-hubspot.test.ts's reference pattern,
 * "admin" is deliberately included in the denied set here rather than the
 * allowed one.
 */
describe("updateBusinessProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early with no session and performs no write", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await updateBusinessProfileAction(
      { error: null, savedAt: null },
      formData({ timezone: "UTC" }),
    );

    expect(result).toEqual({
      error: "Sign in to manage business settings.",
      savedAt: null,
    });
    expect(mockedUpdateOrganizationBusinessProfile).not.toHaveBeenCalled();
  });

  it.each(["member", "admin"] as const)(
    "denies a %s session — this is owner-only, narrower than the connector owner/admin gate",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue(sessionWithRole(role));

      const result = await updateBusinessProfileAction(
        { error: null, savedAt: null },
        formData({ timezone: "UTC" }),
      );

      expect(result).toEqual({
        error: "Only the workspace owner can change business settings.",
        savedAt: null,
      });
      expect(mockedUpdateOrganizationBusinessProfile).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid IANA timezone via the real schema and performs no write", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(sessionWithRole("owner"));

    const result = await updateBusinessProfileAction(
      { error: null, savedAt: null },
      formData({ timezone: "Not/A/Real/Zone" }),
    );

    expect(result.savedAt).toBeNull();
    expect(result.error).not.toBeNull();
    expect(mockedUpdateOrganizationBusinessProfile).not.toHaveBeenCalled();
  });

  it("regression: real gap found by review — refuses to save an unchecked workingDays fieldset (bitmask 0) instead of silently persisting it", async () => {
    // A saved bitmask of 0 used to be accepted as "a real, meaningful
    // submitted state" and previously had a test asserting exactly that.
    // But isWorkingDay/elapsedBusinessHours (@signaldesk/domain) always
    // return false/0 for a 0 bitmask, which silently drives every
    // elapsed-hours threshold in evaluateUntouchedLead/
    // evaluateMessageAwaitingReply/evaluateTicketStuck permanently below
    // its trigger point — a false "all clear" on the One Page with nothing
    // flagging that risk detection went dark. Rejecting it here, before
    // any write, is the honest behavior.
    mockedGetCurrentOrganization.mockResolvedValue(sessionWithRole("owner"));

    const result = await updateBusinessProfileAction(
      { error: null, savedAt: null },
      formData({ timezone: "UTC" }),
    );

    expect(result.savedAt).toBeNull();
    expect(result.error).toBe("Select at least one working day.");
    expect(mockedUpdateOrganizationBusinessProfile).not.toHaveBeenCalled();
  });

  it("converts checked working days into the real bitmask and dollars into cents on the happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(sessionWithRole("owner"));
    mockedUpdateOrganizationBusinessProfile.mockResolvedValue(
      undefined as unknown as Awaited<
        ReturnType<typeof updateOrganizationBusinessProfile>
      >,
    );

    const result = await updateBusinessProfileAction(
      { error: null, savedAt: null },
      formData({
        timezone: "America/Toronto",
        defaultExpectedResponseHours: "48",
        highValueThresholdDollars: "500",
        industry: "professional_services",
        workingDays: ["1", "2", "3"],
      }),
    );

    expect(result.error).toBeNull();
    expect(result.savedAt).not.toBeNull();
    expect(mockedUpdateOrganizationBusinessProfile).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      expect.objectContaining({
        timezone: "America/Toronto",
        defaultExpectedResponseHours: 48,
        highValueThresholdCents: 50_000,
        industry: "professional_services",
        // bits 1, 2, 3 set
        workingDaysBitmask: (1 << 1) | (1 << 2) | (1 << 3),
      }),
    );
  });

  it("returns a description of the failure when the write itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(sessionWithRole("owner"));
    mockedUpdateOrganizationBusinessProfile.mockRejectedValue(
      new Error("db unavailable"),
    );

    const result = await updateBusinessProfileAction(
      { error: null, savedAt: null },
      formData({ timezone: "UTC", workingDays: ["1", "2", "3"] }),
    );

    expect(result).toEqual({
      error: "db unavailable",
      savedAt: null,
    });
  });
});
