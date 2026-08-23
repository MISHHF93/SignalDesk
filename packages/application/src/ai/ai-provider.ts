import type { IntelligenceFinding } from "@signaldesk/intelligence";
import type { AgentCapability, IntelligenceCard } from "@signaldesk/schemas";

/**
 * Bounded structured-generation tasks the orchestration layer asks a
 * provider to perform. Adding a task means adding a case to every
 * `AIProvider` implementation, not widening what an implementation may do
 * with free-form input.
 */
export type StructuredGenerationTask =
  "parse_dashboard_command" | "interpret_findings";

/**
 * Minimal context an AIProvider may use to resolve a task — for example
 * matching "why is Acme at risk" against the cards currently on screen. This
 * is the Context Builder boundary: callers pass only what is already
 * authorized and visible, never raw database access.
 */
export interface DashboardCommandContext {
  readonly visibleCards: readonly IntelligenceCard[];
}

/**
 * Context for `"interpret_findings"`: a specialist agent's bounded task —
 * interpret exactly these already-computed, already-evidenced findings for
 * one capability, never fetch or invent its own data (Agent Fabric's
 * "mustNotInventFacts" constraint, enforced by prompt here and by
 * agent-result-reconciler.ts's evidence-subset check downstream).
 */
export interface AgentInterpretationContext {
  readonly capability: AgentCapability;
  readonly findings: readonly IntelligenceFinding[];
}

export interface GenerateStructuredInput<T> {
  readonly task: StructuredGenerationTask;
  readonly prompt: string;
  readonly context?: DashboardCommandContext | AgentInterpretationContext;
  /** Validates and shapes the provider's raw output; throws on invalid output. */
  readonly parse: (raw: unknown) => T;
  /**
   * The calling `AgentCard`'s declared `timeBudgetMs` (`@signaldesk/schemas`),
   * passed through so a provider that makes a real network call can enforce
   * it as an actual request timeout — previously validated and displayed as
   * metadata but never wired into a real cutoff, so a hung call had no
   * enforced bound. Providers that make no network call (the deterministic
   * provider) simply ignore it.
   */
  readonly timeoutMs?: number;
}

/**
 * Provider-agnostic boundary for model-backed (or, today, deterministic)
 * structured generation. Callers never depend on a specific provider;
 * provider-specific behavior stays behind an implementation of this
 * interface (see `deterministic-provider.ts`).
 */
export interface AIProvider {
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T>;
}
