import type * as ApplicationModule from "@signaldesk/application";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/todays-attention");
vi.mock("@signaldesk/persistence");
// A partial mock, not a wholesale one — see run-agent-investigation.test.ts's
// own comment on why: @signaldesk/application also exports
// createConsoleErrorReporter, which the app's errorReporter singleton
// depends on at import time.
vi.mock("@signaldesk/application", async (importOriginal) => {
  const actual = await importOriginal<typeof ApplicationModule>();
  return { ...actual, generateDailyBrief: vi.fn() };
});

import { generateDailyBrief } from "@signaldesk/application";
import { createArtifact } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { getTodaysAttention } from "../_lib/todays-attention";
import { generateDailyBriefAction } from "./generate-daily-brief";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedGetTodaysAttention = vi.mocked(getTodaysAttention);
const mockedGenerateDailyBrief = vi.mocked(generateDailyBrief);
const mockedCreateArtifact = vi.mocked(createArtifact);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "member",
  email: "member@example.com",
  isAnonymous: false,
};

describe("generateDailyBriefAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [{ id: "finding-1" }],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);
  });

  it("returns early with no session and performs no write", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await generateDailyBriefAction();

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedCreateArtifact).not.toHaveBeenCalled();
  });

  it("assembles the brief from real current findings and persists it on the happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGenerateDailyBrief.mockReturnValue({
      title: "Daily Brief — Aug 25",
      content: "Everything is fine.",
      structuredData: { mode: "daily" },
      sourceFindingIds: ["finding-1"],
    } as unknown as ReturnType<typeof generateDailyBrief>);
    const artifact = { id: "artifact-1", type: "daily_brief" };
    mockedCreateArtifact.mockResolvedValue(
      artifact as Awaited<ReturnType<typeof createArtifact>>,
    );

    const result = await generateDailyBriefAction();

    expect(result).toEqual({ ok: true, artifact });
    expect(mockedGenerateDailyBrief).toHaveBeenCalledWith(
      [{ id: "finding-1" }],
      expect.any(Date),
    );
    expect(mockedCreateArtifact).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        type: "daily_brief",
        title: "Daily Brief — Aug 25",
        content: "Everything is fine.",
        sourceFindingIds: ["finding-1"],
      }),
    );
  });

  it("returns a description of the failure when persisting the artifact throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGenerateDailyBrief.mockReturnValue({
      title: "Daily Brief — Aug 25",
      content: "Everything is fine.",
      structuredData: {},
      sourceFindingIds: [],
    } as unknown as ReturnType<typeof generateDailyBrief>);
    mockedCreateArtifact.mockRejectedValue(new Error("db unavailable"));

    const result = await generateDailyBriefAction();

    expect(result).toEqual({ ok: false, error: "db unavailable" });
  });
});
