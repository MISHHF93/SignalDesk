import { randomUUID } from "node:crypto";

import {
  assembleBusinessSnapshot,
  type BusinessSnapshot,
} from "@signaldesk/application";
import {
  computeBusinessCoverageByPurpose,
  listConnectors,
} from "@signaldesk/integrations";
import {
  createDatabasePool,
  listRecentAuditEvents,
  type DatabasePool,
} from "@signaldesk/persistence";

import { getTodaysAttention } from "./todays-attention";
import type { CurrentSession } from "./session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Assembles the real `BusinessSnapshot` — the canonical bounded object
 * the One-Page Command Center renders from. Reuses `getTodaysAttention`
 * rather than re-deriving findings/coverage/business-profile a second
 * time (it already makes the same database calls this needs); the only
 * new I/O here is `listRecentAuditEvents`. No external provider is ever
 * called synchronously — every input is already a database read this
 * app was already doing.
 */
export async function getBusinessSnapshot(
  session: CurrentSession,
  now: Date,
): Promise<BusinessSnapshot> {
  const db = getPool();
  const [attention, recentActions] = await Promise.all([
    getTodaysAttention(session, now),
    listRecentAuditEvents(db, session.organizationId),
  ]);

  const domainHealth = computeBusinessCoverageByPurpose(
    attention.connectedIntegrationSlugs,
  );

  const connectedSlugSet = new Set(attention.connectedIntegrationSlugs);
  const connectorHealth = listConnectors().map((connector) => ({
    slug: connector.slug,
    name: connector.name,
    purpose: connector.purpose,
    status: connectedSlugSet.has(connector.slug)
      ? ("connected" as const)
      : ("not_connected" as const),
    hasRealSync: connector.readiness.initialSyncImplemented,
  }));

  return assembleBusinessSnapshot({
    organizationId: session.organizationId,
    snapshotId: randomUUID(),
    now,
    findings: attention.findings,
    businessContext: attention.businessProfile,
    recentActions,
    domainHealth,
    connectorHealth,
  });
}
