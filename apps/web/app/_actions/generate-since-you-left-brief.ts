"use server";

import { generateSinceYouLeftBrief } from "@signaldesk/application";
import {
  createArtifact,
  createDatabasePool,
  getLatestArtifact,
  type Artifact,
  type DatabasePool,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";
import { getTodaysAttention } from "../_lib/todays-attention";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export type GenerateSinceYouLeftBriefActionResult =
  | { readonly ok: true; readonly artifact: Artifact }
  | { readonly ok: false; readonly error: string };

/**
 * Generates and persists a "Since You Left" brief — the first real slice
 * of the Executive Brief proposal (`docs/product-vision-backlog.md`,
 * Prompt 19). Diffs the organization's current findings against its most
 * recent `daily_brief` artifact's `sourceFindingIds` (real, already
 * persisted — no new schema). Stored as the same `daily_brief` artifact
 * type as the regular Daily Brief; `structuredData.mode` distinguishes it
 * in history. Mirrors `generateDailyBriefAction`'s safe-action shape
 * exactly: `organizationId` comes only from the authenticated session.
 */
export async function generateSinceYouLeftBriefAction(): Promise<GenerateSinceYouLeftBriefActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    const now = new Date();
    const [{ findings }, previousBrief] = await Promise.all([
      getTodaysAttention(session, now),
      getLatestArtifact(getPool(), session.organizationId, "daily_brief"),
    ]);

    const brief = generateSinceYouLeftBrief(
      findings,
      previousBrief
        ? {
            id: previousBrief.id,
            generatedAt: previousBrief.generatedAt,
            sourceFindingIds: previousBrief.sourceFindingIds,
          }
        : null,
      now,
    );

    const artifact = await createArtifact(getPool(), session.organizationId, {
      type: "daily_brief",
      title: brief.title,
      content: brief.content,
      structuredData: { ...brief.structuredData },
      sourceFindingIds: brief.sourceFindingIds,
    });

    return { ok: true, artifact };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(
        error,
        "Failed to generate the Since You Left brief.",
      ),
    };
  }
}
