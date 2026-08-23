import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface TimeToFirstSync {
  readonly organizationCreatedAt: Date;
  readonly firstSuccessfulSyncAt: Date | null;
  /** `null` until this organization has a real, `succeeded` sync_jobs
   * row from any connector — never a guessed or default value. */
  readonly minutesToFirstSync: number | null;
}

interface TimeToFirstSyncRow {
  readonly created_at: Date;
  readonly first_successful_sync_at: Date | null;
}

/**
 * The one real implicit onboarding milestone (Prompt 37,
 * docs/product-vision-backlog.md, ADR 0046): real elapsed time between an
 * organization's creation and its first successful `sync_jobs` row across
 * any connector — not a wizard, not a `FirstValueMilestone` event log,
 * one honest derived number from two columns that already exist. Derived
 * on read, never persisted (matches `computeConnectorHealth`'s own
 * "derived, never persisted" precedent, ADR 0021) — nothing here can
 * drift from the real underlying rows.
 */
export async function computeTimeToFirstSync(
  pool: DatabasePool,
  organizationId: string,
): Promise<TimeToFirstSync> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<TimeToFirstSyncRow>(
      `select o.created_at,
              (select min(sj.completed_at)
                 from sync_jobs sj
                 where sj.organization_id = o.id and sj.status = 'succeeded'
              ) as first_successful_sync_at
       from organizations o
       where o.id = $1`,
      [organizationId],
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    const minutesToFirstSync = row.first_successful_sync_at
      ? Math.max(
          0,
          Math.round(
            (row.first_successful_sync_at.getTime() -
              row.created_at.getTime()) /
              60_000,
          ),
        )
      : null;

    return {
      organizationCreatedAt: row.created_at,
      firstSuccessfulSyncAt: row.first_successful_sync_at,
      minutesToFirstSync,
    };
  });
}
