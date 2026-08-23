import { describe, expect, it } from "vitest";

import type { IntelligenceFinding } from "@signaldesk/intelligence";
import {
  parseDashboardIntent,
  parseSpecialistInterpretation,
  type IntelligenceCard,
} from "@signaldesk/schemas";

import { createDeterministicProvider } from "./deterministic-provider";

function overdueInvoiceFinding(
  overrides: Partial<IntelligenceFinding> = {},
): IntelligenceFinding {
  return {
    id: "overdue-invoice:org-1:invoice-1",
    type: "invoice.overdue",
    title: "Acme Robotics invoice overdue",
    summary: "Invoice balance remained unpaid 12 days past its due date.",
    severity: "high",
    confidence: 0.9,
    financialContext: {
      label: "Overdue receivable",
      exposureType: "OUTSTANDING_AMOUNT",
      amountCents: 420_000,
      currency: "USD",
    },
    evidence: [],
    freshness: { asOf: new Date(), status: "fresh" },
    explanation: { trigger: "unpaid past due date", confidence: "high" },
    detectedAt: new Date(),
    ...overrides,
  };
}

const VISIBLE_CARDS: readonly IntelligenceCard[] = [
  {
    id: "lead-risk:org-1:lead-1",
    type: "lead_risk",
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

  it("parses a search command into a text-contains filter", async () => {
    const provider = createDeterministicProvider();
    const intent = await provider.generateStructured({
      task: "parse_dashboard_command",
      prompt: "search acme",
      parse: parseDashboardIntent,
    });

    expect(intent).toEqual({
      type: "filter",
      filters: [{ field: "text", operator: "contains", value: "acme" }],
    });
  });

  it("parses a 'find for' command the same way, trimming the query", async () => {
    const provider = createDeterministicProvider();
    const intent = await provider.generateStructured({
      task: "parse_dashboard_command",
      prompt: "find for   Acme Robotics  ",
      parse: parseDashboardIntent,
    });

    expect(intent).toEqual({
      type: "filter",
      filters: [
        { field: "text", operator: "contains", value: "Acme Robotics" },
      ],
    });
  });

  it("rejects a bare search command with no query text", async () => {
    const provider = createDeterministicProvider();

    await expect(
      provider.generateStructured({
        task: "parse_dashboard_command",
        prompt: "search",
        parse: parseDashboardIntent,
      }),
    ).rejects.toThrow();
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
      entityId: "lead-risk:org-1:lead-1",
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
      targets: ["lead-risk:org-1:lead-1"],
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

  it("parses an agent_investigate command, distinct from a why-question", async () => {
    const provider = createDeterministicProvider();
    const intent = await provider.generateStructured({
      task: "parse_dashboard_command",
      prompt: "investigate current risk",
      parse: parseDashboardIntent,
    });

    expect(intent).toEqual({ type: "agent_investigate" });
  });

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

  describe("interpret_findings", () => {
    it("derives claims from the real findings it was given, never inventing new ones", async () => {
      const provider = createDeterministicProvider();
      const finding = overdueInvoiceFinding();

      const result = await provider.generateStructured({
        task: "interpret_findings",
        prompt: "Interpret current financial risk.",
        context: {
          capability: "interpret_financial_risk",
          findings: [finding],
        },
        parse: parseSpecialistInterpretation,
      });

      expect(result.claims).toEqual([finding.summary]);
      expect(result.confidence).toBe(0.9);
      expect(result.recommendation).toContain("1 affected item");
      expect(result.recommendation).toContain("$4,200");
    });

    it("returns no claims and no fabricated recommendation when given no findings", async () => {
      const provider = createDeterministicProvider();

      const result = await provider.generateStructured({
        task: "interpret_findings",
        prompt: "Interpret current financial risk.",
        context: { capability: "interpret_financial_risk", findings: [] },
        parse: parseSpecialistInterpretation,
      });

      expect(result.claims).toEqual([]);
      expect(result.recommendation).toBeUndefined();
    });

    it("combines exposure across multiple findings without inventing a currency", async () => {
      const provider = createDeterministicProvider();
      const findings = [
        overdueInvoiceFinding({ id: "invoice-1" }),
        overdueInvoiceFinding({
          id: "invoice-2",
          summary: "A second invoice is also overdue.",
          financialContext: {
            label: "Overdue receivable",
            exposureType: "OUTSTANDING_AMOUNT",
            amountCents: 80_000,
            currency: "USD",
          },
        }),
      ];

      const result = await provider.generateStructured({
        task: "interpret_findings",
        prompt: "Interpret current financial risk.",
        context: { capability: "interpret_financial_risk", findings },
        parse: parseSpecialistInterpretation,
      });

      expect(result.claims).toHaveLength(2);
      expect(result.recommendation).toContain("2 affected items");
      expect(result.recommendation).toContain("$5,000");
    });

    it("keeps distinct exposure types separate instead of blending them into one misleading total", async () => {
      const provider = createDeterministicProvider();
      const findings = [
        overdueInvoiceFinding({
          id: "invoice-1",
          financialContext: {
            label: "Overdue receivable",
            exposureType: "OUTSTANDING_AMOUNT",
            amountCents: 420_000,
            currency: "USD",
          },
        }),
        overdueInvoiceFinding({
          id: "lead-1",
          type: "lead.follow_up_risk",
          summary: "No recorded interaction for 31 hours.",
          financialContext: {
            label: "Pipeline value",
            exposureType: "POTENTIAL_EXPOSURE",
            amountCents: 1_800_000,
            currency: "USD",
          },
        }),
      ];

      const result = await provider.generateStructured({
        task: "interpret_findings",
        prompt: "Interpret current financial risk.",
        context: { capability: "interpret_financial_risk", findings },
        parse: parseSpecialistInterpretation,
      });

      expect(result.recommendation).toContain("Outstanding amount: US$4,200.");
      expect(result.recommendation).toContain("Potential exposure: US$18,000.");
      // The misleading blended sum a naive `amountCents` reduce would have
      // produced ($4,200 + $18,000) — must never appear.
      expect(result.recommendation).not.toContain("$22,200");
    });
  });
});
