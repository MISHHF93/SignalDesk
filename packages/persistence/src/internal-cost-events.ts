import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Internal-only unit-economics instrumentation — never customer-facing
 * metering. The explicit requirement this exists for: don't bill
 * customers by tokens/webhooks/events/records/AI calls, but do track
 * those internally so a real cost-per-plan picture can validate whether
 * launch pricing is actually sustainable, instead of guessing.
 *
 * Nothing in this codebase calls `recordInternalCostEvent` yet — there is
 * no real AI-orchestration or connector-sync pipeline today that
 * generates a cost to record. This function is real and tested plumbing,
 * not a placeholder, but it's honestly unwired until one of those
 * pipelines exists.
 */
export interface RecordInternalCostEventInput {
  readonly eventType: string;
  readonly quantity?: number;
  readonly estimatedCostCents?: number;
  readonly metadata?: Record<string, unknown>;
}

export async function recordInternalCostEvent(
  pool: DatabasePool,
  organizationId: string,
  input: RecordInternalCostEventInput,
): Promise<void> {
  await withTenantContext(pool, organizationId, async (client) => {
    await client.query(
      `insert into public.internal_cost_events
         (id, organization_id, event_type, quantity, estimated_cost_cents, metadata)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        organizationId,
        input.eventType,
        input.quantity ?? 1,
        input.estimatedCostCents ?? null,
        input.metadata ?? {},
      ],
    );
  });
}

export interface InternalCostSummary {
  readonly eventType: string;
  readonly totalQuantity: number;
  readonly totalEstimatedCostCents: number;
  readonly eventCount: number;
}

/**
 * Aggregate cost by event type for one organization over a real date
 * range — the query real internal tooling would use to answer "what does
 * a Business-plan customer actually cost us." Nothing calls this yet
 * either, for the same reason: no real cost events exist to summarize.
 */
export async function getInternalCostSummary(
  pool: DatabasePool,
  organizationId: string,
  since: Date,
): Promise<readonly InternalCostSummary[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{
      event_type: string;
      total_quantity: string;
      total_estimated_cost_cents: string | null;
      event_count: string;
    }>(
      `select event_type,
              sum(quantity) as total_quantity,
              sum(coalesce(estimated_cost_cents, 0)) as total_estimated_cost_cents,
              count(*) as event_count
       from public.internal_cost_events
       where organization_id = $1 and occurred_at >= $2
       group by event_type
       order by total_estimated_cost_cents desc`,
      [organizationId, since],
    );

    return result.rows.map((row) => ({
      eventType: row.event_type,
      totalQuantity: Number(row.total_quantity),
      totalEstimatedCostCents: Number(row.total_estimated_cost_cents ?? 0),
      eventCount: Number(row.event_count),
    }));
  });
}
