import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export type ArtifactType = "daily_brief";

export type ArtifactStatus =
  | "draft"
  | "generated"
  | "reviewed"
  | "approved"
  | "published"
  | "superseded"
  | "archived";

export interface Artifact {
  readonly id: string;
  readonly organizationId: string;
  readonly type: ArtifactType;
  readonly title: string;
  readonly status: ArtifactStatus;
  readonly generatedBy: "deterministic-assembly";
  readonly content: string;
  readonly structuredData: Record<string, unknown>;
  readonly sourceFindingIds: readonly string[];
  readonly generatedAt: Date;
}

interface ArtifactDbRow {
  readonly id: string;
  readonly organization_id: string;
  readonly type: ArtifactType;
  readonly title: string;
  readonly status: ArtifactStatus;
  readonly generated_by: "deterministic-assembly";
  readonly content: string;
  readonly structured_data: Record<string, unknown>;
  readonly source_finding_ids: readonly string[];
  readonly generated_at: Date;
}

function toArtifact(row: ArtifactDbRow): Artifact {
  return {
    id: row.id,
    organizationId: row.organization_id,
    type: row.type,
    title: row.title,
    status: row.status,
    generatedBy: row.generated_by,
    content: row.content,
    structuredData: row.structured_data,
    sourceFindingIds: row.source_finding_ids,
    generatedAt: row.generated_at,
  };
}

const ARTIFACT_SELECT = `
  select id, organization_id, type, title, status, generated_by, content,
         structured_data, source_finding_ids, generated_at
  from public.artifacts
`;

export interface CreateArtifactInput {
  readonly type: ArtifactType;
  readonly title: string;
  readonly content: string;
  readonly structuredData: Record<string, unknown>;
  readonly sourceFindingIds: readonly string[];
}

/**
 * Persists a real, deterministically-assembled artifact — always created
 * with status `generated` (v1 has no draft/review/approval workflow to
 * put anything in another state; see the migration's own doc comment).
 */
export async function createArtifact(
  pool: DatabasePool,
  organizationId: string,
  input: CreateArtifactInput,
): Promise<Artifact> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<ArtifactDbRow>(
      `insert into public.artifacts
         (id, organization_id, type, title, content, structured_data, source_finding_ids)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, organization_id, type, title, status, generated_by, content,
                 structured_data, source_finding_ids, generated_at`,
      [
        randomUUID(),
        organizationId,
        input.type,
        input.title,
        input.content,
        JSON.stringify(input.structuredData),
        input.sourceFindingIds,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("artifacts insert returned no row");
    }

    return toArtifact(row);
  });
}

/**
 * The most recently generated artifact of a given type — what "today's
 * Daily Brief" means on repeat visits without regenerating one on every
 * page load.
 */
export async function getLatestArtifact(
  pool: DatabasePool,
  organizationId: string,
  type: ArtifactType,
): Promise<Artifact | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<ArtifactDbRow>(
      `${ARTIFACT_SELECT} where organization_id = $1 and type = $2
       order by generated_at desc
       limit 1`,
      [organizationId, type],
    );

    const row = result.rows[0];
    return row ? toArtifact(row) : null;
  });
}

const MAX_ARTIFACT_HISTORY = 30;

/**
 * The organization's artifact history for a given type, newest first —
 * older Daily Briefs are persisted from the day they're generated but
 * were unreachable until this existed (only `getLatestArtifact` did).
 * Reads the same `artifacts_org_type_generated_index` backwards; capped
 * like every other "real set" list in this app (`listOverdueInvoices`,
 * `listOverdueTasks`) rather than returning unbounded history.
 */
export async function listArtifacts(
  pool: DatabasePool,
  organizationId: string,
  type: ArtifactType,
): Promise<readonly Artifact[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<ArtifactDbRow>(
      `${ARTIFACT_SELECT} where organization_id = $1 and type = $2
       order by generated_at desc
       limit ${MAX_ARTIFACT_HISTORY}`,
      [organizationId, type],
    );

    return result.rows.map(toArtifact);
  });
}
