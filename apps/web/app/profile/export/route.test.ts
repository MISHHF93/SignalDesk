import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_lib/session");
vi.mock("../../_lib/rate-limit");
vi.mock("../../_lib/request-origin");
vi.mock("@signaldesk/persistence");

import { exportOrganizationData } from "@signaldesk/persistence";

import { checkRateLimit } from "../../_lib/rate-limit";
import { getRequestOrigin } from "../../_lib/request-origin";
import { getCurrentOrganization } from "../../_lib/session";
import { GET } from "./route";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);
const mockedGetRequestOrigin = vi.mocked(getRequestOrigin);
const mockedExportOrganizationData = vi.mocked(exportOrganizationData);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "owner",
  email: "owner@example.com",
  isAnonymous: false,
} as const;

/**
 * Real behavioral coverage for a route that had none, added alongside the
 * rate-limit fix itself: this was a second, previously-overlooked instance
 * of the same gap `business/snapshot/route.ts` was already fixed for — a
 * real authenticated endpoint with no bound on repeat calls, here fronting
 * a heavier full multi-table export.
 */
describe("profile/export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetRequestOrigin.mockResolvedValue("https://app.example.com");
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mockedExportOrganizationData.mockResolvedValue({
      organization: { id: "org-1" },
    } as Awaited<ReturnType<typeof exportOrganizationData>>);
  });

  it("returns 401 for an unauthenticated visitor without exporting anything", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockedExportOrganizationData).not.toHaveBeenCalled();
  });

  it("refuses at the rate limit without exporting anything", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCheckRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 3600,
    });

    const response = await GET();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3600");
    expect(mockedExportOrganizationData).not.toHaveBeenCalled();
  });

  it("returns a real, downloadable export with the correct headers on the happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);

    const response = await GET();

    expect(mockedCheckRateLimit).toHaveBeenCalledWith(
      undefined,
      "profile-export:org-1",
      5,
      60 * 60 * 1000,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Content-Disposition")).toContain(
      "signaldesk-export-org-1.json",
    );
    expect(await response.json()).toEqual({
      organization: { id: "org-1" },
    });
  });

  it("redirects to an honest failure banner rather than a bare error page when the export itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedExportOrganizationData.mockRejectedValue(new Error("db timeout"));

    const response = await GET();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.example.com/profile?profile=export_failed",
    );
  });
});
