import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { resolveMembershipId } from "./membership";
import { withTenantContext } from "./tenant-context";

/**
 * A real, narrow first slice of Adaptive Attention (Prompt 17,
 * docs/product-vision-backlog.md, ADR 0032) — capture only, no ranking
 * adjustment yet. `findingId` is the deterministic id every
 * IntelligenceCapability already produces
 * (`{capabilityId}:{organizationId}:{entityId}`), so feedback attaches to
 * something real and stable without needing a persisted Signal entity.
 */

export type CardFeedbackValue = "useful" | "not_relevant";

export interface RecordCardFeedbackInput {
  readonly userId: string;
  readonly findingId: string;
  readonly cardType: string;
  readonly feedback: CardFeedbackValue;
}

export interface CardFeedbackRecord {
  readonly id: string;
  readonly findingId: string;
  readonly cardType: string;
  readonly feedback: CardFeedbackValue;
  readonly createdAt: Date;
}

interface CardFeedbackRow {
  readonly id: string;
  readonly finding_id: string;
  readonly card_type: string;
  readonly feedback: string;
  readonly created_at: Date;
}

function toRecord(row: CardFeedbackRow): CardFeedbackRecord {
  return {
    id: row.id,
    findingId: row.finding_id,
    cardType: row.card_type,
    feedback: row.feedback as CardFeedbackValue,
    createdAt: row.created_at,
  };
}

/**
 * Records one real feedback event — append-only, like `audit_events`: a
 * person changing their mind (useful -> not_relevant) is a new row, not
 * an update to the old one, preserving the real history of reactions
 * rather than only the latest. No idempotency key: a double-click creates
 * two identical rows. Any real aggregate consumer (see
 * `listRecentCardFeedback` below) should read "most recent row per
 * (membership, finding)" when that distinction matters — a deliberate,
 * disclosed simplification for this narrow first slice, not an oversight.
 */
export async function recordCardFeedback(
  pool: DatabasePool,
  organizationId: string,
  input: RecordCardFeedbackInput,
): Promise<CardFeedbackRecord> {
  return withTenantContext(pool, organizationId, async (client) => {
    const membershipId = await resolveMembershipId(
      client,
      organizationId,
      input.userId,
    );

    const result = await client.query<CardFeedbackRow>(
      `insert into card_feedback (id, organization_id, membership_id, finding_id, card_type, feedback)
       values ($1, $2, $3, $4, $5, $6)
       returning id, finding_id, card_type, feedback, created_at`,
      [
        randomUUID(),
        organizationId,
        membershipId,
        input.findingId,
        input.cardType,
        input.feedback,
      ],
    );

    return toRecord(result.rows[0]!);
  });
}

const MAX_RECENT_CARD_FEEDBACK = 200;

/**
 * The organization's real feedback history, newest first — capped like
 * every other "real set" list in this app (`listRecentAuditEvents`,
 * `listOverdueInvoices`). The first real reader of `card_feedback`: a
 * future Evaluation Lab first slice (Prompt 13) or a future ranking
 * adjustment can both start from this rather than a raw table scan.
 */
export async function listRecentCardFeedback(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly CardFeedbackRecord[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<CardFeedbackRow>(
      `select id, finding_id, card_type, feedback, created_at
       from card_feedback
       where organization_id = $1
       order by created_at desc
       limit ${MAX_RECENT_CARD_FEEDBACK}`,
      [organizationId],
    );

    return result.rows.map(toRecord);
  });
}
