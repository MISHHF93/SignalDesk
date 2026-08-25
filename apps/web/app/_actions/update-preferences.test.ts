import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("@signaldesk/persistence");

import { updateOrganizationPreferences } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { updatePreferencesAction } from "./update-preferences";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedUpdateOrganizationPreferences = vi.mocked(
  updateOrganizationPreferences,
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

function formData(checkedFields: readonly string[]): FormData {
  const data = new FormData();
  for (const field of checkedFields) {
    data.set(field, "on");
  }
  return data;
}

/**
 * Same owner-ONLY gate as update-business-profile.test.ts — narrower than
 * ADR 0062's owner-or-admin connector gate, so "admin" is deliberately
 * denied here too. Every checkbox is always submitted (checked or not),
 * so there is no "field absent" case to cover — an unchecked box simply
 * means `false`.
 */
describe("updatePreferencesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early with no session and performs no write", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await updatePreferencesAction(
      { error: null, savedAt: null },
      formData([]),
    );

    expect(result).toEqual({
      error: "Sign in to manage preferences.",
      savedAt: null,
    });
    expect(mockedUpdateOrganizationPreferences).not.toHaveBeenCalled();
  });

  it.each(["member", "admin"] as const)(
    "denies a %s session — this is owner-only, narrower than the connector owner/admin gate",
    async (role) => {
      mockedGetCurrentOrganization.mockResolvedValue(sessionWithRole(role));

      const result = await updatePreferencesAction(
        { error: null, savedAt: null },
        formData([]),
      );

      expect(result).toEqual({
        error: "Only the workspace owner can change preferences.",
        savedAt: null,
      });
      expect(mockedUpdateOrganizationPreferences).not.toHaveBeenCalled();
    },
  );

  it("translates every checked box into a real true and every unchecked one into a real false", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(sessionWithRole("owner"));
    mockedUpdateOrganizationPreferences.mockResolvedValue(
      undefined as unknown as Awaited<
        ReturnType<typeof updateOrganizationPreferences>
      >,
    );

    const result = await updatePreferencesAction(
      { error: null, savedAt: null },
      formData(["morningBriefEnabled", "weeklyRecapEnabled"]),
    );

    expect(result.error).toBeNull();
    expect(result.savedAt).not.toBeNull();
    expect(mockedUpdateOrganizationPreferences).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      {
        morningBriefEnabled: true,
        attentionAlertsEnabled: false,
        weeklyRecapEnabled: true,
      },
    );
  });

  it("returns a description of the failure when the write itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(sessionWithRole("owner"));
    mockedUpdateOrganizationPreferences.mockRejectedValue(
      new Error("db unavailable"),
    );

    const result = await updatePreferencesAction(
      { error: null, savedAt: null },
      formData([]),
    );

    expect(result).toEqual({
      error: "db unavailable",
      savedAt: null,
    });
  });
});
