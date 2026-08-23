import type { DatabasePool } from "./client";
import { insertAuditEvent } from "./audit-events";
import { withTenantContext } from "./tenant-context";

/**
 * Which of a connection's declared write capabilities are currently
 * enabled — the primitive README's target architecture already describes
 * ("read messages — Enabled, send messages — Approval Only"). Real and
 * persisted (`integrations.enabled_capability_ids`), but nothing calls
 * `updateConnectorSettings` yet — no connector has a real write action to
 * gate (every `readiness.actionsImplemented` is `false`). A settings UI is
 * the natural next step once one does; out of scope here (ADR 0021).
 */
export interface ConnectorSettings {
  readonly connectionId: string;
  readonly enabledCapabilityIds: readonly string[];
}

interface ConnectorSettingsRow {
  readonly id: string;
  readonly enabled_capability_ids: readonly string[];
}

function toSettings(row: ConnectorSettingsRow): ConnectorSettings {
  return {
    connectionId: row.id,
    enabledCapabilityIds: row.enabled_capability_ids,
  };
}

export async function getConnectorSettings(
  pool: DatabasePool,
  organizationId: string,
  connectionId: string,
): Promise<ConnectorSettings> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<ConnectorSettingsRow>(
      `select id, enabled_capability_ids from integrations
       where organization_id = $1 and id = $2`,
      [organizationId, connectionId],
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error(`Integration ${connectionId} not found`);
    }

    return toSettings(row);
  });
}

/**
 * Replaces the connection's enabled-capability set and records the change
 * as a real audit event, in the same transaction as the update — a
 * failure here rolls back the settings change too, instead of leaving a
 * committed change with no audit record (mirrors
 * `updateOrganizationBusinessProfile`'s own same-transaction pattern).
 */
export async function updateConnectorSettings(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  connectionId: string,
  enabledCapabilityIds: readonly string[],
): Promise<ConnectorSettings> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<ConnectorSettingsRow>(
      `update integrations
       set enabled_capability_ids = $3
       where organization_id = $1 and id = $2
       returning id, enabled_capability_ids`,
      [organizationId, connectionId, enabledCapabilityIds],
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error(`Integration ${connectionId} not found`);
    }

    await insertAuditEvent(client, organizationId, {
      userId,
      eventType: "connector.settings_updated",
      subjectType: "integration",
      subjectId: connectionId,
      outcome: "succeeded",
      metadata: { enabledCapabilityIds: [...enabledCapabilityIds] },
    });

    return toSettings(row);
  });
}
