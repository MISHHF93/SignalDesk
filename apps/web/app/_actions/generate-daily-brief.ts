"use server";

import { generateDailyBrief } from "@signaldesk/application";
import {
  createArtifact,
  createDatabasePool,
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

export type GenerateDailyBriefActionResult =
  | { readonly ok: true; readonly artifact: Artifact }
  | { readonly ok: false; readonly error: string };

/**
 * Generates and persists a real Daily Brief artifact — assembled from the
 * organization's actual current findings (re-derived at click time via
 * `getTodaysAttention`, never trusting stale client-held state), not
 * fabricated AI prose (see `generateDailyBrief`'s own doc comment). The
 * safe action pattern every other real write in this app follows:
 * `organizationId` comes exclusively from the authenticated session.
 */
export async function generateDailyBriefAction(): Promise<GenerateDailyBriefActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    const now = new Date();
    const { findings } = await getTodaysAttention(session, now);
    const brief = generateDailyBrief(findings, now);

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
      error: describeActionError(error, "Failed to generate the Daily Brief."),
    };
  }
}
