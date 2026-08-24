import {
  createDatabasePool,
  getOrganizationBusinessProfile,
  listActiveIntegrationSourceSystems,
  listAllInvoices,
  listAllLeads,
  listAllTasks,
  listGoals,
  listLeadsForAttention,
  listOpenInternalTasks,
  listOverdueInvoices,
  listOverdueTasks,
  listRecentPayments,
  listStuckSupportTickets,
  listUnansweredExternalMessages,
  type DatabasePool,
  type GoalRecord,
  type OpenInternalTask,
  type OrganizationBusinessProfile,
} from "@signaldesk/persistence";
import type { BusinessAttention } from "@signaldesk/application";
import {
  computeBusinessMetrics,
  type MetricValue,
} from "@signaldesk/semantics";

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
  /** The real Business Semantic Layer (Prompt 21,
   * docs/product-vision-backlog.md, ADR 0034) — every catalog metric
   * (@signaldesk/semantics) computed fresh from the same already-fetched
   * data below, never a second independent calculation. */
  readonly metrics: readonly MetricValue[];
  /** Every real goal the organization has defined (Prompt 22, ADR 0035) —
   * `page.tsx` renders these directly (status computed from `metrics`
   * above via `evaluateGoal`) rather than re-fetching. */
  readonly goals: readonly GoalRecord[];
  /**
   * Every internal task still open — the other half of the loop a card's
   * "create a task" quick action only ever started: without this, a task
   * created from the One Page had nowhere to be seen or marked done again.
   * `page.tsx` renders these via `TasksPanel`.
   */
  readonly openTasks: readonly OpenInternalTask[];
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
    leads,
    overdueInvoices,
    overdueTasks,
    recentPayments,
    connectedIntegrationSlugs,
    businessProfile,
    allInvoices,
    allLeads,
    allTasks,
    goals,
    recentUnansweredMessages,
    stuckSupportTickets,
    openTasks,
  ] = await Promise.all([
    listLeadsForAttention(db, session.organizationId),
    listOverdueInvoices(db, session.organizationId),
    listOverdueTasks(db, session.organizationId),
    listRecentPayments(db, session.organizationId),
    listActiveIntegrationSourceSystems(db, session.organizationId),
    getOrganizationBusinessProfile(db, session.organizationId),
    listAllInvoices(db, session.organizationId),
    listAllLeads(db, session.organizationId),
    listAllTasks(db, session.organizationId),
    listGoals(db, session.organizationId),
    listUnansweredExternalMessages(db, session.organizationId),
    listStuckSupportTickets(db, session.organizationId),
    listOpenInternalTasks(db, session.organizationId),
  ]);

  const metrics = computeBusinessMetrics({
    now,
    allInvoices,
    overdueInvoices,
    leads: allLeads,
    recentPayments,
    tasks: allTasks,
  });

  const attention = await businessAIOrchestrator.getAttention({
    leads,
    overdueInvoices,
    overdueTasks,
    recentPayments,
    now,
    connectedIntegrationSlugs,
    highValueThresholdCents: businessProfile.highValueThresholdCents,
    workingDaysBitmask: businessProfile.workingDaysBitmask,
    timeZone: businessProfile.timezone,
    goals,
    businessMetrics: metrics,
    recentUnansweredMessages,
    defaultExpectedResponseHours: businessProfile.defaultExpectedResponseHours,
    stuckSupportTickets,
  });

  return {
    ...attention,
    connectedIntegrationSlugs,
    businessProfile,
    metrics,
    goals,
    openTasks,
  };
}
