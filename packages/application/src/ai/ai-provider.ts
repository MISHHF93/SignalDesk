import type { IntelligenceCard } from "@business-dashboard/schemas";

/**
 * Bounded structured-generation tasks the orchestration layer asks a
 * provider to perform. Adding a task means adding a case to every
 * `AIProvider` implementation, not widening what an implementation may do
 * with free-form input.
 */
export type StructuredGenerationTask = "parse_dashboard_command";

/**
 * Minimal context an AIProvider may use to resolve a task — for example
 * matching "why is Acme at risk" against the cards currently on screen. This
 * is the Context Builder boundary: callers pass only what is already
 * authorized and visible, never raw database access.
 */
export interface DashboardCommandContext {
  readonly visibleCards: readonly IntelligenceCard[];
}

export interface GenerateStructuredInput<T> {
  readonly task: StructuredGenerationTask;
  readonly prompt: string;
  readonly context?: DashboardCommandContext;
  /** Validates and shapes the provider's raw output; throws on invalid output. */
  readonly parse: (raw: unknown) => T;
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
