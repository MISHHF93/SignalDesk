import type {
  Invoice,
  Lead,
  Message,
  SupportTicket,
  Task,
} from "@signaldesk/domain";

import type { Artifact } from "./artifacts";
import { listArtifacts } from "./artifacts";
import type { RecentAuditEvent } from "./audit-events";
import { listRecentAuditEvents } from "./audit-events";
import type { DatabasePool } from "./client";
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
