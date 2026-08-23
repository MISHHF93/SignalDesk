import type { PrioritizedFinding } from "./finding";

/**
 * A first, deliberately narrow slice of attention as a bounded resource —
 * research surfaced this session recommends treating attention closer to
 * CPU/memory than an unbounded ranked list: a healthy business should
 * consume little of it, and something entering "Needs Attention" should
 * answer more than "did severity cross a threshold." The full version of
 * that idea (Business Event → Situation Fusion → Materiality → User
 * Relevance → Actionability → Attention Admission → Presentation) needs
 * two things this app doesn't have yet: a canonical Customer/Account
 * entity to fuse findings about the same real-world situation across
 * types (already tracked as a disclosed gap — see
 * `dashboard-composition.ts`'s and `overdue-invoice.ts`'s doc comments on
 * why no cross-entity correlation exists), and session/actor context
 * threaded into this otherwise-pure pipeline to evaluate real
 * user-relevance. Building the full pipeline without those would be
 * modeling stages this app can't actually populate honestly.
 *
 * What this DOES implement, honestly: every deterministic capability
 * already gates materiality at the source (each only emits a finding once
 * its own real threshold is crossed — `evaluateOverdueInvoice`/
 * `evaluateUntouchedLead`/etc., `@signaldesk/domain`), and every finding
 * today is actionable by construction (`recommendedActionTypes` is never
 * empty for a registered capability) — so neither of those admission
 * questions currently filters anything real. What's missing is the third:
 * "is something more important already consuming that attention slot?"
 * Per-capability lists are already bounded (`MAX_OVERDUE_INVOICES`/
 * `MAX_OVERDUE_TASKS`/`MAX_LEADS_FOR_ATTENTION`, `@signaldesk/persistence`,
 * 10 each), but nothing previously bounded the *combined* total — an
 * organization with several capabilities each near their own cap could
 * see 40+ simultaneous cards, the exact "wall of separate signals" this
 * product's own operating principles want to avoid. This caps the total
 * admitted into presentation to the highest-priority `maxAdmitted`
 * (`prioritizeFindings`'s output is already sorted by `priorityScore`
 * descending, so admission is simply "keep the top N") — real findings
 * below the cap are never silently discarded, only deferred; callers must
 * surface `deferredCount` honestly (e.g. "N more lower-priority items not
 * shown") rather than making the drop invisible.
 */
export interface AttentionAdmissionResult {
  readonly admitted: readonly PrioritizedFinding[];
  readonly deferredCount: number;
}

// Matches the existing per-capability cap convention
// (`MAX_OVERDUE_INVOICES`/`MAX_OVERDUE_TASKS`/`MAX_LEADS_FOR_ATTENTION`)
// rather than inventing an unrelated number — the same "don't overwhelm
// the one-page" reasoning, applied across capabilities instead of within
// one.
export const DEFAULT_MAX_ADMITTED_FINDINGS = 12;

export function applyAttentionAdmission(
  findings: readonly PrioritizedFinding[],
  maxAdmitted: number = DEFAULT_MAX_ADMITTED_FINDINGS,
): AttentionAdmissionResult {
  return {
    admitted: findings.slice(0, maxAdmitted),
    deferredCount: Math.max(0, findings.length - maxAdmitted),
  };
}
