import type { IntelligenceFinding } from "@signaldesk/intelligence";

/**
 * A deterministic, pre-generation evidence-sufficiency check for the
 * Agent Fabric's one real AI trigger (`run-agent-investigation.ts`) —
 * SignalDesk decides whether there's enough real evidence to investigate
 * *before* calling the model, rather than trusting the model's own
 * self-reported confidence/limitations to catch an evidence gap after the
 * fact. Deliberately narrow: a real 2026 evidence-sufficiency benchmark
 * found models over-answer under conflicting/insufficient evidence far
 * too often (a reported 65-91% over-answer rate), which is the concrete
 * motivation — this is the smallest honest slice of that principle this
 * app can implement today, not the full `SUFFICIENT/PARTIAL/STALE/
 * LOW_AUTHORITY/CONFLICTING/MISSING` classification a real retrieval
 * system would need. SignalDesk has no RAG/retrieval layer at all (100%
 * deterministic SQL + rule-based detection) and a single narrow
 * `{claims, recommendation, limitations, confidence}` output schema, so
 * "authority"/"contradiction" classification ahead of generation isn't
 * something this app has the inputs to do honestly yet — building that
 * machinery now, for a retrieval system that doesn't exist, would be
 * exactly the speculative-infrastructure trap this repo's own operating
 * principles warn against. What *is* real and already computed per
 * finding: `freshness.status` (`freshnessStatus`, `@signaldesk/intelligence`).
 * This aggregates that existing signal into one pre-call decision.
 */
export type EvidenceSufficiency = "sufficient" | "stale" | "missing";

export function classifyEvidenceSufficiency(
  findings: readonly IntelligenceFinding[],
): EvidenceSufficiency {
  if (findings.length === 0) {
    return "missing";
  }

  const hasNonStaleEvidence = findings.some(
    (finding) => finding.freshness.status !== "stale",
  );

  return hasNonStaleEvidence ? "sufficient" : "stale";
}
