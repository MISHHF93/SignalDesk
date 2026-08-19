import {
  createDatabasePool,
  getOrganizationBusinessProfile,
  getPriorityLead,
  listActiveIntegrationSourceSystems,
  listOverdueInvoices,
  listOverdueTasks,
  type DatabasePool,
  type OrganizationBusinessProfile,
} from "@business-dashboard/persistence";
import type { BusinessAttention } from "@business-dashboard/application";

import { businessAIOrchestrator } from "./orchestrator";
import type { CurrentSession } from "./session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export interface TodaysAttention extends BusinessAttention {
  readonly connectedIntegrationSlugs: readonly string[];
  readonly businessProfile: OrganizationBusinessProfile;
}

/**
 * The one place that assembles a real `IntelligenceContext` and runs the
 * Business AI Node — shared between the command center's own render
 * (`page.tsx`) and anything else that needs today's real findings (the
 * Daily Brief artifact action). Always re-derives from the database at
 * call time rather than accepting findings as a parameter, so a Daily
 * Brief generated a few minutes after the page loaded reflects what's
 * actually true then, not a stale render-time snapshot. Also returns
 * `connectedIntegrationSlugs`/`businessProfile` since `page.tsx` needs
 * both for its own display (connection count, timezone) and would
 * otherwise re-fetch them a second time.
 */
export async function getTodaysAttention(
  session: CurrentSession,
  now: Date,
): Promise<TodaysAttention> {
  const db = getPool();
  const [
    lead,
    overdueInvoices,
    overdueTasks,
    connectedIntegrationSlugs,
    businessProfile,
  ] = await Promise.all([
    getPriorityLead(db, session.organizationId),
    listOverdueInvoices(db, session.organizationId),
    listOverdueTasks(db, session.organizationId),
    listActiveIntegrationSourceSystems(db, session.organizationId),
    getOrganizationBusinessProfile(db, session.organizationId),
  ]);

  const attention = await businessAIOrchestrator.getAttention({
    lead,
    overdueInvoices,
    overdueTasks,
    now,
    connectedIntegrationSlugs,
    highValueThresholdCents: businessProfile.highValueThresholdCents,
    workingDaysBitmask: businessProfile.workingDaysBitmask,
    timeZone: businessProfile.timezone,
  });

  return { ...attention, connectedIntegrationSlugs, businessProfile };
}
