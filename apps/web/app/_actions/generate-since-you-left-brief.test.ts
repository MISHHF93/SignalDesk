import type * as ApplicationModule from "@signaldesk/application";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/todays-attention");
vi.mock("@signaldesk/persistence");
// A partial mock, not a wholesale one — see run-agent-investigation.test.ts's
// own comment on why.
vi.mock("@signaldesk/application", async (importOriginal) => {
  const actual = await importOriginal<typeof ApplicationModule>();
  return { ...actual, generateSinceYouLeftBrief: vi.fn() };
});

import { generateSinceYouLeftBrief } from "@signaldesk/application";
import { createArtifact, getLatestArtifact } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { getTodaysAttention } from "../_lib/todays-attention";
import { generateSinceYouLeftBriefAction } from "./generate-since-you-left-brief";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedGetTodaysAttention = vi.mocked(getTodaysAttention);
const mockedGetLatestArtifact = vi.mocked(getLatestArtifact);
const mockedGenerateSinceYouLeftBrief = vi.mocked(generateSinceYouLeftBrief);
const mockedCreateArtifact = vi.mocked(createArtifact);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "member",
  email: "member@example.com",
  isAnonymous: false,
};

describe("generateSinceYouLeftBriefAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTodaysAttention.mockResolvedValue({
      findings: [{ id: "finding-2" }],
    } as unknown as Awaited<ReturnType<typeof getTodaysAttention>>);
    mockedGetLatestArtifact.mockResolvedValue(null);
  });

  it("returns early with no session and performs no write", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await generateSinceYouLeftBriefAction();

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedCreateArtifact).not.toHaveBeenCalled();
  });

  it("diffs against a null previous brief honestly (first-ever brief) on the happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGetLatestArtifact.mockResolvedValue(null);
    mockedGenerateSinceYouLeftBrief.mockReturnValue({
      title: "Since You Left",
      content: "Nothing new to report.",
      structuredData: { mode: "since_you_left" },
      sourceFindingIds: ["finding-2"],
    } as unknown as ReturnType<typeof generateSinceYouLeftBrief>);
    const artifact = { id: "artifact-2", type: "daily_brief" };
    mockedCreateArtifact.mockResolvedValue(
      artifact as Awaited<ReturnType<typeof createArtifact>>,
    );

    const result = await generateSinceYouLeftBriefAction();

    expect(result).toEqual({ ok: true, artifact });
    expect(mockedGenerateSinceYouLeftBrief).toHaveBeenCalledWith(
      [{ id: "finding-2" }],
      null,
      expect.any(Date),
    );
  });

  it("diffs against a real previous brief's sourceFindingIds when one exists", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    const previousBrief = {
      id: "artifact-1",
      generatedAt: new Date("2026-08-24T00:00:00Z"),
      sourceFindingIds: ["finding-1"],
    };
    mockedGetLatestArtifact.mockResolvedValue(
      previousBrief as unknown as Awaited<ReturnType<typeof getLatestArtifact>>,
    );
    mockedGenerateSinceYouLeftBrief.mockReturnValue({
      title: "Since You Left",
      content: "One new finding.",
      structuredData: {},
      sourceFindingIds: ["finding-2"],
    } as unknown as ReturnType<typeof generateSinceYouLeftBrief>);
    mockedCreateArtifact.mockResolvedValue({
      id: "artifact-2",
    } as unknown as Awaited<ReturnType<typeof createArtifact>>);

    await generateSinceYouLeftBriefAction();

    expect(mockedGenerateSinceYouLeftBrief).toHaveBeenCalledWith(
      [{ id: "finding-2" }],
      {
        id: "artifact-1",
        generatedAt: previousBrief.generatedAt,
        sourceFindingIds: ["finding-1"],
      },
      expect.any(Date),
    );
  });

  it("returns a description of the failure when persisting the artifact throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedGenerateSinceYouLeftBrief.mockReturnValue({
      title: "Since You Left",
      content: "Nothing new.",
      structuredData: {},
      sourceFindingIds: [],
    } as unknown as ReturnType<typeof generateSinceYouLeftBrief>);
    mockedCreateArtifact.mockRejectedValue(new Error("db unavailable"));

    const result = await generateSinceYouLeftBriefAction();

    expect(result).toEqual({ ok: false, error: "db unavailable" });
  });
});
