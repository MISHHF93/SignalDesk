import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Internal-only unit-economics instrumentation — never customer-facing
 * metering. The explicit requirement this exists for: don't bill
 * customers by tokens/webhooks/events/records/AI calls, but do track
 * those internally so a real cost-per-plan picture can validate whether
 * launch pricing is actually sustainable, instead of guessing.
 *
 * `recordInternalCostEvent` is called for real now, from
 * `AgentGatewayService` (`apps/web/app/_lib/agent-gateway.ts`, Prompt 36,
 * docs/product-vision-backlog.md, ADR 0045) whenever a specialist backed
 * by the real Claude provider (`agent.provider === "anthropic"`) is
 * dispatched — the one real model-calling path this codebase has.
 */
export interface InternalCostEvent {
  readonly id: string;
  readonly organizationId: string;
  readonly eventType: string;
  readonly quantity: number;
  readonly estimatedCostCents: number | null;
  readonly metadata: Record<string, unknown>;
  readonly occurredAt: Date;
}

interface InternalCostEventRow {
  readonly id: string;
  readonly organization_id: string;
  readonly event_type: string;
  readonly quantity: string;
  readonly estimated_cost_cents: number | null;
  readonly metadata: Record<string, unknown>;
  readonly occurred_at: Date;
}

function toInternalCostEvent(row: InternalCostEventRow): InternalCostEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    eventType: row.event_type,
    quantity: Number(row.quantity),
    estimatedCostCents: row.estimated_cost_cents,
    metadata: row.metadata,
    occurredAt: row.occurred_at,
  };
}

export interface RecordInternalCostEventInput {
  readonly eventType: string;
  readonly quantity?: number;
  /** `null` when no verified per-unit pricing exists yet for this event
   * type — an honest gap, never a fabricated dollar figure. No per-token
   * pricing table exists in this codebase today, so real Claude
   * invocations are recorded with `estimatedCostCents: null` until one
   * does. */
  readonly estimatedCostCents?: number | null;
  readonly metadata?: Record<string, unknown>;
}

/**
 * The actual insert, given an already tenant-scoped client — mirrors
 * `insertAuditEvent`'s own split (audit-events.ts): shared by
 * `recordInternalCostEvent` (opens its own transaction) and
 * `recordOutcome` (agent-gateway.ts), which composes this with
 * `insertAgentTaskResultWithClient`/`insertAuditEvent` in one transaction
 * — see `insertAgentTaskResultWithClient`'s own doc comment for the real
 * bug this closes.
 */
export async function recordInternalCostEventWithClient(
  client: PoolClient,
  organizationId: string,
  input: RecordInternalCostEventInput,
): Promise<InternalCostEvent> {
  const result = await client.query<InternalCostEventRow>(
    `insert into public.internal_cost_events
       (id, organization_id, event_type, quantity, estimated_cost_cents, metadata)
     values ($1, $2, $3, $4, $5, $6)
     returning id, organization_id, event_type, quantity, estimated_cost_cents, metadata, occurred_at`,
    [
      randomUUID(),
      organizationId,
      input.eventType,
      input.quantity ?? 1,
      input.estimatedCostCents ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("internal_cost_events insert returned no row");
  }

  return toInternalCostEvent(row);
}

export async function recordInternalCostEvent(
  pool: DatabasePool,
  organizationId: string,
  input: RecordInternalCostEventInput,
): Promise<InternalCostEvent> {
  return withTenantContext(pool, organizationId, (client) =>
    recordInternalCostEventWithClient(client, organizationId, input),
  );
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
 * a Business-plan customer actually cost us." Still nothing renders this
 * anywhere (Prompt 36's reality check scoped this slice to instrumenting
 * the one real write, not building a dashboard on top of it) — kept as
 * real, tested plumbing ahead of that need, same as before this ADR.
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
