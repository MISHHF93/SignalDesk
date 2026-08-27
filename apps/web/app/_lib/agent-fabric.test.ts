import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@signaldesk/application");
vi.mock("@signaldesk/persistence");
vi.mock("./agent-config");

import {
  createClaudeProvider,
  createDeterministicProvider,
  type AIProvider,
} from "@signaldesk/application";
import {
  getAIProviderApiKey,
  type DatabasePool,
} from "@signaldesk/persistence";
import type { AgentCard } from "@signaldesk/schemas";

import {
  getClaudeApiKey,
  getClaudeModel,
  isClaudeConfigured,
} from "./agent-config";
import type * as AgentFabricModule from "./agent-fabric";

const POOL = undefined as unknown as DatabasePool;

const mockedCreateClaudeProvider = vi.mocked(createClaudeProvider);
const mockedCreateDeterministicProvider = vi.mocked(
  createDeterministicProvider,
);
const mockedGetAIProviderApiKey = vi.mocked(getAIProviderApiKey);
const mockedGetClaudeApiKey = vi.mocked(getClaudeApiKey);
const mockedGetClaudeModel = vi.mocked(getClaudeModel);
const mockedIsClaudeConfigured = vi.mocked(isClaudeConfigured);

const DETERMINISTIC_PROVIDER = {
  generateStructured: vi.fn(),
} as unknown as AIProvider;

const PLATFORM_CLAUDE_PROVIDER = {
  generateStructured: vi.fn(),
} as unknown as AIProvider;

const ORG_CLAUDE_PROVIDER = {
  generateStructured: vi.fn(),
} as unknown as AIProvider;

/**
 * Real behavioral coverage for a function that had none: `providerFor`
 * decides whether a real, paid Claude API call is funded by an
 * organization's own BYO key, the platform-wide key, or falls back to the
 * deterministic specialist — every existing caller (`run-agent-
 * investigation.ts`, `draft-entity-content-action.ts`, `draft-message-
 * reply-action.ts`) mocks the whole module away instead of exercising this
 * real branching logic, the same shape of gap the Twelfth pass already
 * closed for `draft-content-coordinator.ts` in `packages/application`.
 *
 * `createDeterministicProvider()`/`getClaudeProvider()`'s module-scoped
 * singleton run at import time, so every test re-imports the module fresh
 * via `vi.resetModules()` — otherwise the singleton constructed by one
 * test's mocks would leak into the next.
 */
describe("agent-fabric", () => {
  let providerFor: typeof AgentFabricModule.providerFor;
  let availabilityFor: typeof AgentFabricModule.availabilityFor;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mockedCreateDeterministicProvider.mockReturnValue(DETERMINISTIC_PROVIDER);
    mockedGetClaudeApiKey.mockReturnValue("platform-key");
    mockedGetClaudeModel.mockReturnValue(undefined);
    mockedIsClaudeConfigured.mockReturnValue(false);
    mockedGetAIProviderApiKey.mockResolvedValue(null);
    mockedCreateClaudeProvider.mockImplementation((options) =>
      options.apiKey === "platform-key"
        ? PLATFORM_CLAUDE_PROVIDER
        : ORG_CLAUDE_PROVIDER,
    );

    const mod = await import("./agent-fabric");
    providerFor = mod.providerFor;
    availabilityFor = mod.availabilityFor;
  });

  it("returns the deterministic provider for any non-Claude agent id, without ever checking for an org key", async () => {
    const provider = await providerFor(
      "deterministic-specialist",
      "org-1",
      POOL,
    );

    expect(provider).toBe(DETERMINISTIC_PROVIDER);
    expect(mockedGetAIProviderApiKey).not.toHaveBeenCalled();
    expect(mockedCreateClaudeProvider).not.toHaveBeenCalled();
  });

  it("prefers a real, enabled organization BYO Anthropic key over the platform-wide key", async () => {
    mockedGetAIProviderApiKey.mockResolvedValue("org-specific-key");

    const provider = await providerFor("claude-specialist", "org-1", POOL);

    expect(provider).toBe(ORG_CLAUDE_PROVIDER);
    expect(mockedGetAIProviderApiKey).toHaveBeenCalledWith(
      POOL,
      "org-1",
      "anthropic",
    );
    expect(mockedCreateClaudeProvider).toHaveBeenCalledWith({
      apiKey: "org-specific-key",
    });
  });

  it("passes the configured model through for a real org key, when one is set", async () => {
    mockedGetAIProviderApiKey.mockResolvedValue("org-specific-key");
    mockedGetClaudeModel.mockReturnValue("claude-org-model");

    await providerFor("claude-specialist", "org-1", POOL);

    expect(mockedCreateClaudeProvider).toHaveBeenCalledWith({
      apiKey: "org-specific-key",
      model: "claude-org-model",
    });
  });

  it("falls back to the platform-wide Claude provider when no org key exists but Claude is configured", async () => {
    mockedIsClaudeConfigured.mockReturnValue(true);

    const provider = await providerFor("claude-specialist", "org-1", POOL);

    expect(provider).toBe(PLATFORM_CLAUDE_PROVIDER);
    expect(mockedCreateClaudeProvider).toHaveBeenCalledWith({
      apiKey: "platform-key",
    });
  });

  it("reuses the same platform-wide Claude provider singleton across calls, rather than reconstructing it", async () => {
    mockedIsClaudeConfigured.mockReturnValue(true);

    await providerFor("claude-specialist", "org-1", POOL);
    await providerFor("claude-specialist", "org-2", POOL);

    expect(mockedCreateClaudeProvider).toHaveBeenCalledTimes(1);
  });

  it("falls back to the deterministic provider when no org key exists and Claude isn't configured at all", async () => {
    const provider = await providerFor("claude-specialist", "org-1", POOL);

    expect(provider).toBe(DETERMINISTIC_PROVIDER);
    expect(mockedCreateClaudeProvider).not.toHaveBeenCalled();
  });

  it("availabilityFor: a deterministic card is always available regardless of Claude configuration", () => {
    const availability = availabilityFor();

    expect(
      availability.isAvailable({
        provider: "deterministic",
      } as unknown as AgentCard),
    ).toBe(true);
  });

  it("availabilityFor: a Claude-backed card is available only when Claude is actually configured", () => {
    const availability = availabilityFor();
    const claudeCard = { provider: "anthropic" } as unknown as AgentCard;

    mockedIsClaudeConfigured.mockReturnValue(false);
    expect(availability.isAvailable(claudeCard)).toBe(false);

    mockedIsClaudeConfigured.mockReturnValue(true);
    expect(availability.isAvailable(claudeCard)).toBe(true);
  });
});
