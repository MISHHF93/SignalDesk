import type {
  Invoice,
  Lead,
  Message,
  SupportTicket,
  Task,
} from "@signaldesk/domain";

import type { AgentCollaboration } from "./agent-collaborations";
import { listRecentAgentCollaborations } from "./agent-collaborations";
import type { Artifact } from "./artifacts";
import { listArtifacts } from "./artifacts";
import type { RecentAuditEvent } from "./audit-events";
import { listRecentAuditEvents } from "./audit-events";
import type { DatabasePool } from "./client";
import type { GoalRecord } from "./goals";
import { listGoals } from "./goals";
import type { OpenInternalTask } from "./internal-tasks";
import { listOpenInternalTasks } from "./internal-tasks";
import { listAllInvoices } from "./invoices";
import { listAllLeads } from "./leads";
import { listAllMessages } from "./messages";
import { listAllSupportTickets } from "./support-tickets";
import { getOrganizationSubscription } from "./subscriptions";
import type { OrganizationSubscription } from "./subscriptions";
import { listAllTasks } from "./tasks";
import { withTenantContext } from "./tenant-context";

export interface OrganizationExportSummary {
  readonly id: string;
  readonly displayName: string;
  readonly slug: string;
  readonly timezone: string;
  readonly createdAt: Date;
}

/**
 * A real "export my data" package — every real business record this app
 * holds for an organization, gathered in one place. Each list is capped
 * (see the entity-specific `listAllXxx` functions' own doc comments) and
 * that cap is a real field here, not a silent truncation. `recentAuditEvents`
 * reuses `listRecentAuditEvents`'s existing 10-item cap rather than a
 * separate uncapped query — a known, disclosed limitation for a v1 export,
 * not a full historical audit dump.
 *
 * Real gap found by review: this doc comment's own claim ("every real
 * business record") stopped being true as the schema grew — `goals`
 * (0041), `internal_tasks` (0014), and `agent_collaborations` (0034) all
 * predate this fix but were never wired in, despite each already having a
 * ready-made, tenant-scoped list function sitting unused. ADR 0018
 * explicitly warned this would recur ("any future entity added to the
 * Business Graph should extend `anonymize_organization` and
 * `exportOrganizationData` in the same migration that adds the entity,
 * not as a follow-up gap") and it was missed a third time; closed here
 * for these three. The 5 "Safe Action" write-path tables (real customer/
 * vendor communications this app actually sent) remain a known, disclosed
 * gap — no export-shaped query function exists for any of them yet, a
 * larger undertaking than wiring in an existing one.
 */
export interface OrganizationDataExport {
  readonly exportedAt: Date;
  readonly organization: OrganizationExportSummary;
  readonly leads: readonly Lead[];
  readonly invoices: readonly Invoice[];
  readonly tasks: readonly Task[];
  /** Never carries `bodyPreview` — `Message` (`@signaldesk/domain`) has
   * no such field at all, a structural guarantee, not a convention (see
   * that type's own doc comment). An export of "every message" is still
   * bounded to what a card or AI prompt could see, not the full raw
   * body. */
  readonly messages: readonly Message[];
  readonly supportTickets: readonly SupportTicket[];
  readonly artifacts: readonly Artifact[];
  readonly recentAuditEvents: readonly RecentAuditEvent[];
  readonly subscription: OrganizationSubscription | null;
  readonly goals: readonly GoalRecord[];
  /** Open only — `listOpenInternalTasks`' own real scope, honestly named
   * to match rather than implying a full historical task list. */
  readonly openInternalTasks: readonly OpenInternalTask[];
  /** Newest-first, capped — `listRecentAgentCollaborations`' own real
   * scope, same "recent, not exhaustive" honesty `recentAuditEvents`
   * already establishes for this export. Includes real AI-drafted
   * customer-facing content (`draftedContent`) and investigation
   * rationale (`reconciledSummary`) tied to this organization's own
   * leads/invoices/tasks/messages/tickets. */
  readonly recentAgentCollaborations: readonly AgentCollaboration[];
}

interface OrganizationSummaryRow {
  readonly id: string;
  readonly display_name: string;
  readonly slug: string;
  readonly timezone: string;
  readonly created_at: Date;
}

async function getOrganizationExportSummary(
  pool: DatabasePool,
  organizationId: string,
): Promise<OrganizationExportSummary> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<OrganizationSummaryRow>(
      `select id, display_name, slug, timezone, created_at
       from public.organizations
       where id = $1`,
      [organizationId],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error(`organization ${organizationId} not found`);
    }

    return {
      id: row.id,
      displayName: row.display_name,
      slug: row.slug,
      timezone: row.timezone,
      createdAt: row.created_at,
    };
  });
}

/**
 * Assembles the full real data-export package for an organization —
 * every read here is a real, already-tenant-scoped query against real
 * tables, nothing synthesized.
 */
export async function exportOrganizationData(
  pool: DatabasePool,
  organizationId: string,
): Promise<OrganizationDataExport> {
  const [
    organization,
    leads,
    invoices,
    tasks,
    messages,
    supportTickets,
    artifacts,
    recentAuditEvents,
    subscription,
    goals,
    openInternalTasks,
    recentAgentCollaborations,
  ] = await Promise.all([
    getOrganizationExportSummary(pool, organizationId),
    listAllLeads(pool, organizationId),
    listAllInvoices(pool, organizationId),
    listAllTasks(pool, organizationId),
    listAllMessages(pool, organizationId),
    listAllSupportTickets(pool, organizationId),
    listArtifacts(pool, organizationId, "daily_brief"),
    listRecentAuditEvents(pool, organizationId),
    getOrganizationSubscription(pool, organizationId),
    listGoals(pool, organizationId),
    listOpenInternalTasks(pool, organizationId),
    listRecentAgentCollaborations(pool, organizationId),
  ]);

  return {
    exportedAt: new Date(),
    organization,
    leads,
    invoices,
    tasks,
    messages,
    supportTickets,
    artifacts,
    recentAuditEvents,
    subscription,
    goals,
    openInternalTasks,
    recentAgentCollaborations,
  };
}

/**
 * The real "delete my organization" request — see migration 0032 and
 * ADR 0018 for the full design. Anonymizes PII (organization display
 * name/slug, the sole-membership user's identity, lead/invoice/task
 * customer-facing names) and marks the organization deactivated, which
 * `resolve_memberships_for_identity` (0032) now excludes from ever
 * resolving to a session again. Provenance/audit tables are deliberately
 * left untouched — see the migration's own comments for why.
 *
 * Does not itself cancel a Stripe subscription or disconnect integrations
 * — the caller (the Server Action) is responsible for those, since both
 * are real external API calls this persistence-layer function shouldn't
 * make silently, and both already have real, tested functions elsewhere
 * (`cancelSubscriptionAtPeriodEnd`, `disconnectXxxIntegration`).
 */
export async function anonymizeOrganization(
  pool: DatabasePool,
  organizationId: string,
): Promise<void> {
  return withTenantContext(pool, organizationId, async (client) => {
    await client.query(`select public.anonymize_organization($1)`, [
      organizationId,
    ]);
  });
}
