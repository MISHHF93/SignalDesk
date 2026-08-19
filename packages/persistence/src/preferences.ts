import type { DatabasePool } from "./client";
import { insertAuditEvent } from "./audit-events";
import { withTenantContext } from "./tenant-context";

export interface OrganizationPreferences {
  readonly morningBriefEnabled: boolean;
  readonly attentionAlertsEnabled: boolean;
  readonly weeklyRecapEnabled: boolean;
}

interface PreferencesRow {
  readonly morning_brief_enabled: boolean;
  readonly attention_alerts_enabled: boolean;
  readonly weekly_recap_enabled: boolean;
}

function toPreferences(row: PreferencesRow): OrganizationPreferences {
  return {
    morningBriefEnabled: row.morning_brief_enabled,
    attentionAlertsEnabled: row.attention_alerts_enabled,
    weeklyRecapEnabled: row.weekly_recap_enabled,
  };
}

export async function getOrganizationPreferences(
  pool: DatabasePool,
  organizationId: string,
): Promise<OrganizationPreferences> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<PreferencesRow>(
      `select morning_brief_enabled, attention_alerts_enabled, weekly_recap_enabled
       from organizations where id = $1`,
      [organizationId],
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    return toPreferences(row);
  });
}

/**
 * Updates all three preferences at once (the form always submits every
 * checkbox's real state, checked or not, so there is no partial-update
 * case to support the way `updateOrganizationBusinessProfile` has to
 * handle optional fields).
 */
export async function updateOrganizationPreferences(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  input: OrganizationPreferences,
): Promise<OrganizationPreferences> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<PreferencesRow>(
      `update organizations
       set morning_brief_enabled = $2,
           attention_alerts_enabled = $3,
           weekly_recap_enabled = $4
       where id = $1
       returning morning_brief_enabled, attention_alerts_enabled, weekly_recap_enabled`,
      [
        organizationId,
        input.morningBriefEnabled,
        input.attentionAlertsEnabled,
        input.weeklyRecapEnabled,
      ],
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    // Same transaction as the update above, matching
    // `updateOrganizationBusinessProfile`'s reasoning — a failure here
    // rolls back the preference change too, instead of leaving a
    // committed change with no audit record.
    await insertAuditEvent(client, organizationId, {
      userId,
      eventType: "organization.preferences_updated",
      subjectType: "organization",
      subjectId: organizationId,
      outcome: "succeeded",
      metadata: { ...input },
    });

    return toPreferences(row);
  });
}
