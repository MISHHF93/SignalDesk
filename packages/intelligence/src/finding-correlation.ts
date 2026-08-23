import type { PrioritizedFinding } from "./finding";

/**
 * The smallest honest slice of "multiple systems may report the same
 * underlying business situation — that should read as one thing, not N
 * unrelated alerts" (the wrapper's own Signal Fusion principle). A real
 * persisted Signal that evolves as evidence changes needs a Signal
 * lifecycle this app doesn't have yet (no persisted `signals` table is
 * actually read/written anywhere — a disclosed, tracked gap). This does
 * NOT build that. It groups already-computed findings that share the
 * same real, normalized customer/company name
 * (`correlationName`/`normalizeEntityName`, `@signaldesk/domain`) — the
 * exact same deterministic, exact-string matching
 * `@signaldesk/data-quality`'s cross-system duplicate-entity detector
 * already uses — so the presentation layer can say "these N items may
 * describe the same real situation" instead of rendering them as
 * unrelated cards with no visible connection.
 *
 * Deliberately a *hint*, never a merge: correlated findings are still
 * fully separate, independently evidenced records afterward — this
 * repo's own rule against auto-merging entities on anything less certain
 * than an exact match applies just as much to grouping presentation as
 * it would to combining data. A false-positive name collision here costs
 * a slightly-too-broad hint, never lost or hidden evidence.
 */
export interface CorrelationGroup {
  readonly correlationName: string;
  readonly findingIds: readonly string[];
}

/**
 * Maps each finding id that belongs to a group of 2+ same-`correlationName`
 * findings to that group. A finding with no `correlationName`, or whose
 * name matches no other finding, is simply absent from the returned map —
 * not every finding needs to resolve a lookup here.
 */
export function correlateFindingsByName(
  findings: readonly PrioritizedFinding[],
): ReadonlyMap<string, CorrelationGroup> {
  const idsByName = new Map<string, string[]>();

  for (const finding of findings) {
    const name = finding.correlationName;

    if (!name) {
      continue;
    }

    const existing = idsByName.get(name);

    if (existing) {
      existing.push(finding.id);
    } else {
      idsByName.set(name, [finding.id]);
    }
  }

  const groupByFindingId = new Map<string, CorrelationGroup>();

  for (const [correlationName, findingIds] of idsByName) {
    if (findingIds.length < 2) {
      continue;
    }

    const group: CorrelationGroup = { correlationName, findingIds };

    for (const id of findingIds) {
      groupByFindingId.set(id, group);
    }
  }

  return groupByFindingId;
}
