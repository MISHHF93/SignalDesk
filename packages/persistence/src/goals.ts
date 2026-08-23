import { createHash, randomUUID } from "node:crypto";

import {
  STANDARD_AUDIT_RETENTION_CLASS,
  STANDARD_AUDIT_RETENTION_INTERVAL,
} from "./audit-retention";
import type { DatabasePool } from "./client";
import { resolveMembershipId } from "./membership";
import { withTenantContext } from "./tenant-context";

/**
 * Goal Intelligence (Prompt 22, docs/product-vision-backlog.md, ADR 0035):
 * a goal's own definition only, mirroring `createInternalTask`'s real
 * idempotent-write-plus-audit-event pattern exactly. `metricId` is a
 * `@signaldesk/semantics` `METRIC_CATALOG` id — this package has no
 * dependency on `@signaldesk/semantics` (same boundary every other
 * persistence module already draws against domain-logic packages), so the
 * five allowed values are enforced only by the database check constraint
 * (`goals_metric_id_allowed`, migration 0041) and by the caller (the
 * `createGoalInputSchema` Zod validator in `@signaldesk/schemas`).
 */

export type GoalComparisonOperator = "at_most" | "at_least";

export interface CreateGoalInput {
  readonly userId: string;
  readonly metricId: string;
  readonly name: string;
  readonly comparisonOperator: GoalComparisonOperator;
  readonly targetValue: number;
  readonly currency: string | null;
  readonly idempotencyKey: string;
}

export interface GoalRecord {
  readonly id: string;
  readonly ownerMembershipId: string;
  readonly metricId: string;
  readonly name: string;
  readonly comparisonOperator: GoalComparisonOperator;
  readonly targetValue: number;
  readonly currency: string | null;
  readonly createdAt: Date;
}

export interface CreateGoalResult extends GoalRecord {
  /** `false` on an idempotent replay — see `createInternalTask`'s own
   * doc comment for why this distinction matters to the caller. */
  readonly created: boolean;
}

interface GoalRow {
  readonly id: string;
  readonly owner_membership_id: string;
  readonly metric_id: string;
  readonly name: string;
  readonly comparison_operator: string;
  readonly target_value: string;
  readonly currency: string | null;
  readonly created_at: Date;
}

function toRecord(row: GoalRow): GoalRecord {
  return {
    id: row.id,
    ownerMembershipId: row.owner_membership_id,
    metricId: row.metric_id,
    name: row.name,
    comparisonOperator: row.comparison_operator as GoalComparisonOperator,
    // bigint columns come back from `pg` as strings (avoiding silent
    // precision loss at the driver level) — the same `Number()` boundary
    // conversion `invoices.ts`'s `toInvoice` already applies to
    // `amount_cents`, safe here for the same reason: no goal target this
    // app can produce approaches `Number.MAX_SAFE_INTEGER` cents.
    targetValue: Number(row.target_value),
    currency: row.currency,
    createdAt: row.created_at,
  };
}

/**
 * Creates a goal and its audit event in one tenant-scoped transaction —
 * the same idempotent-insert-plus-audit shape `createInternalTask` already
 * established. `input.idempotencyKey` must be stable across a retry of the
 * same logical request, never freshly random per call.
 */
export async function createGoal(
  pool: DatabasePool,
  organizationId: string,
  input: CreateGoalInput,
): Promise<CreateGoalResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const membershipId = await resolveMembershipId(
      client,
      organizationId,
      input.userId,
    );

    const goalId = randomUUID();

    const insertResult = await client.query<GoalRow>(
      `insert into goals (
         id, organization_id, owner_membership_id, metric_id, name,
         comparison_operator, target_value, currency, idempotency_key
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (organization_id, idempotency_key) do nothing
       returning id, owner_membership_id, metric_id, name, comparison_operator, target_value, currency, created_at`,
      [
        goalId,
        organizationId,
        membershipId,
        input.metricId,
        input.name,
        input.comparisonOperator,
        input.targetValue,
        input.currency,
        input.idempotencyKey,
      ],
    );

    const insertedGoal = insertResult.rows[0];

    if (!insertedGoal) {
      const existingResult = await client.query<GoalRow>(
        `select id, owner_membership_id, metric_id, name, comparison_operator, target_value, currency, created_at
         from goals
         where organization_id = $1 and idempotency_key = $2`,
        [organizationId, input.idempotencyKey],
      );
      const existingGoal = existingResult.rows[0];

      if (!existingGoal) {
        throw new Error("goals idempotency conflict but no existing row found");
      }

      return { ...toRecord(existingGoal), created: false };
    }

    const auditEventId = randomUUID();
    const metadata = JSON.stringify({
      metricId: input.metricId,
      name: input.name,
      comparisonOperator: input.comparisonOperator,
      targetValue: input.targetValue,
    });
    const payloadDigest = createHash("sha256")
      .update(`${insertedGoal.id}:${input.metricId}:${input.targetValue}`)
      .digest("hex");
    const eventDigest = createHash("sha256")
      .update(`${auditEventId}:${insertedGoal.id}`)
      .digest("hex");
    const auditIdempotencyKey = `goal-create:${insertedGoal.id}`;

    await client.query(
      `insert into audit_events (
         id, organization_id, actor_membership_id, actor_kind, event_type, event_schema_version,
         subject_type, subject_id, correlation_id, idempotency_key, outcome,
         payload_digest, event_digest, metadata, retention_class, retain_until, occurred_at
       ) values (
         $1, $2, $3, 'user', 'goal.created', 1, 'goal', $4, $5, $6, 'succeeded',
         $7, $8, $9::jsonb, $10, now() + $11::interval, now()
       )`,
      [
        auditEventId,
        organizationId,
        membershipId,
        insertedGoal.id,
        auditIdempotencyKey,
        auditIdempotencyKey,
        payloadDigest,
        eventDigest,
        metadata,
        STANDARD_AUDIT_RETENTION_CLASS,
        STANDARD_AUDIT_RETENTION_INTERVAL,
      ],
    );

    return { ...toRecord(insertedGoal), created: true };
  });
}

const MAX_GOALS = 100;

/**
 * Every real goal for the organization, newest first — capped like every
 * other "real set" list in this app (`listOverdueInvoices`,
 * `listRecentCardFeedback`). The one real reader `goalVarianceIntelligence`
 * (`@signaldesk/intelligence`) uses to know what to evaluate.
 */
export async function listGoals(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly GoalRecord[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<GoalRow>(
      `select id, owner_membership_id, metric_id, name, comparison_operator, target_value, currency, created_at
       from goals
       where organization_id = $1
       order by created_at desc
       limit ${MAX_GOALS}`,
      [organizationId],
    );

    return result.rows.map(toRecord);
  });
}
