import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("../_lib/orchestrator", () => ({
  businessAIOrchestrator: { interpretCommand: vi.fn() },
}));

import { businessAIOrchestrator } from "../_lib/orchestrator";
import { getCurrentOrganization } from "../_lib/session";
import { parseCommandAction } from "./parse-command";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedInterpretCommand = vi.mocked(
  businessAIOrchestrator.interpretCommand,
);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "member",
  email: "member@example.com",
  isAnonymous: false,
};

/**
 * The one Server Action here re-checks the session even though the real
 * command bar only ever renders after `/` already requires one — a Server
 * Action is an independently callable endpoint regardless of which page
 * renders its trigger.
 */
describe("parseCommandAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an honest 'not recognized' result with no session, without ever reaching the orchestrator", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await parseCommandAction("  create task  ", []);

    expect(result).toEqual({ recognized: false, rawText: "create task" });
    expect(mockedInterpretCommand).not.toHaveBeenCalled();
  });

  it("routes a signed-in caller's command through the single Business AI Node", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedInterpretCommand.mockResolvedValue({
      recognized: true,
      rawText: "create task",
    } as unknown as Awaited<
      ReturnType<typeof businessAIOrchestrator.interpretCommand>
    >);
    const visibleCards = [{ id: "card-1" }] as unknown as Parameters<
      typeof parseCommandAction
    >[1];

    const result = await parseCommandAction("create task", visibleCards);

    expect(result).toEqual({ recognized: true, rawText: "create task" });
    expect(mockedInterpretCommand).toHaveBeenCalledWith(
      "create task",
      visibleCards,
    );
  });

  it("falls back to an honest 'not recognized' result (never a raw error) when the session lookup itself throws", async () => {
    mockedGetCurrentOrganization.mockRejectedValue(new Error("db unavailable"));

    const result = await parseCommandAction("create task", []);

    expect(result).toEqual({ recognized: false, rawText: "create task" });
  });

  it("falls back the same way when the orchestrator itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedInterpretCommand.mockRejectedValue(new Error("model unavailable"));

    const result = await parseCommandAction("create task", []);

    expect(result).toEqual({ recognized: false, rawText: "create task" });
  });
});
