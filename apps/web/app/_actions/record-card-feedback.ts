"use server";

import {
  createDatabasePool,
  recordCardFeedback,
  type CardFeedbackValue,
  type DatabasePool,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export type RecordCardFeedbackActionResult =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

/**
 * The real write half of Adaptive Attention's first slice (Prompt 17,
 * docs/product-vision-backlog.md, ADR 0032). `findingId`/`cardType` come
 * from the real `IntelligenceCard` already rendered — never guessed or
 * reconstructed server-side.
 */
export async function recordCardFeedbackAction(
  findingId: string,
  cardType: string,
  feedback: CardFeedbackValue,
): Promise<RecordCardFeedbackActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    await recordCardFeedback(getPool(), session.organizationId, {
      userId: session.userId,
      findingId,
      cardType,
      feedback,
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to record feedback."),
    };
  }
}
