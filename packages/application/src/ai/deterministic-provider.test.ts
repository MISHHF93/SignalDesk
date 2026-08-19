import { describe, expect, it } from "vitest";

import {
  parseDashboardIntent,
  type IntelligenceCard,
} from "@signaldesk/schemas";

import { createDeterministicProvider } from "./deterministic-provider";

const VISIBLE_CARDS: readonly IntelligenceCard[] = [
  {
    id: "stuck:org-1:lead-1",
    type: "stuck",
    title: "Priya Nair at Acme Robotics",
    summary: "No recorded interaction for 31 hours.",
    priority: 90,
    severity: "high",
    explanation: { trigger: "no contact", confidence: "high" },
    sources: [],
    recommendedActions: [],
    freshness: { asOf: new Date(), status: "fresh" },
  },
];

describe("createDeterministicProvider", () => {
  it("parses a financial-amount filter command", async () => {
    const provider = createDeterministicProvider();
    const intent = await provider.generateStructured({
      task: "parse_dashboard_command",
      prompt: "only show items over $10,000",
      parse: parseDashboardIntent,
    });

    expect(intent).toEqual({
      type: "filter",
      filters: [{ field: "financialAmount", operator: "gte", value: 10_000 }],
    });
  });

  it("parses a severity filter command", async () => {
    const provider = createDeterministicProvider();
    const intent = await provider.generateStructured({
      task: "parse_dashboard_command",
      prompt: "show only critical items",
      parse: parseDashboardIntent,
    });

    expect(intent).toEqual({
      type: "filter",
      filters: [{ field: "severity", operator: "eq", value: "critical" }],
    });
  });

  it("resolves an investigate command against visible cards", async () => {
    const provider = createDeterministicProvider();
    const intent = await provider.generateStructured({
      task: "parse_dashboard_command",
      prompt: "why is Acme Robotics at risk",
      context: { visibleCards: VISIBLE_CARDS },
      parse: parseDashboardIntent,
    });

    expect(intent).toEqual({
      type: "investigate",
      entityId: "stuck:org-1:lead-1",
    });
  });

  it("proposes create_internal_task targeting visible cards", async () => {
    const provider = createDeterministicProvider();
    const intent = await provider.generateStructured({
      task: "parse_dashboard_command",
      prompt: "create a task for these",
      context: { visibleCards: VISIBLE_CARDS },
      parse: parseDashboardIntent,
    });

    expect(intent).toEqual({
      type: "propose_action",
      actionType: "create_internal_task",
      targets: ["stuck:org-1:lead-1"],
    });
  });

  it("rejects an unrecognized command instead of guessing", async () => {
    const provider = createDeterministicProvider();

    await expect(
      provider.generateStructured({
        task: "parse_dashboard_command",
        prompt: "make me a sandwich",
        parse: parseDashboardIntent,
      }),
    ).rejects.toThrow();
  });

  it.each([
    "the only high-value deal we have",
    "this is our only critical client",
    "that was our only low point this quarter",
    "the only medium sized office lease",
  ])(
    "does not silently apply a severity filter to an ordinary sentence: %s",
    async (prompt) => {
      const provider = createDeterministicProvider();

      await expect(
        provider.generateStructured({
          task: "parse_dashboard_command",
          prompt,
          parse: parseDashboardIntent,
        }),
      ).rejects.toThrow();
    },
  );

  it.each([
    "leftover $10,000 in the budget",
    "revenue carryover $5,000 needs review",
    "we had a rollover $2,500 balance",
    "moreover $500 was spent",
  ])(
    "does not silently apply an amount filter to an ordinary sentence: %s",
    async (prompt) => {
      const provider = createDeterministicProvider();

      await expect(
        provider.generateStructured({
          task: "parse_dashboard_command",
          prompt,
          parse: parseDashboardIntent,
        }),
      ).rejects.toThrow();
    },
  );

  it("rejects an investigate command with no matching visible card", async () => {
    const provider = createDeterministicProvider();

    await expect(
      provider.generateStructured({
        task: "parse_dashboard_command",
        prompt: "why is Globex at risk",
        context: { visibleCards: VISIBLE_CARDS },
        parse: parseDashboardIntent,
      }),
    ).rejects.toThrow();
  });

  it("rejects an unsupported task", async () => {
    const provider = createDeterministicProvider();

    await expect(
      provider.generateStructured({
        // @ts-expect-error intentionally invalid task for this test
        task: "explain_card",
        prompt: "why",
        parse: parseDashboardIntent,
      }),
    ).rejects.toThrow(/Unsupported structured generation task/);
  });
});
