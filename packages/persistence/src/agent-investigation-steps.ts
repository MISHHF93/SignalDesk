import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export type InvestigationStepStatus = "pending" | "running" | "done" | "failed";

export interface InvestigationStep {
  readonly id: string;
  readonly collaborationId: string;
  readonly stepIndex: number;
  readonly label: string;
  readonly status: InvestigationStepStatus;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
}

interface InvestigationStepRow {
  readonly id: string;
  readonly collaboration_id: string;
  readonly step_index: number;
  readonly label: string;
  readonly status: string;
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
}

const STEP_COLUMNS =
  "id, collaboration_id, step_index, label, status, started_at, completed_at";

function toStep(row: InvestigationStepRow): InvestigationStep {
  return {
    id: row.id,
    collaborationId: row.collaboration_id,
    stepIndex: row.step_index,
    label: row.label,
    status: row.status as InvestigationStepStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

/**
 * Declares the whole step plan up front, all 'pending' — the Work Mat's
 * real "Devin-style" plan list (docs/adr/0063-agent-investigation-progress.md):
 * a caller (run-agent-investigation.ts) builds `labels` from which domains
 * actually have real findings to check, so a step only ever appears for
 * work that's genuinely about to happen, never a fabricated fixed list.
 * `labels` order becomes step_index order (0-based).
 */
export async function appendInvestigationSteps(
  pool: DatabasePool,
  organizationId: string,
  collaborationId: string,
  labels: readonly string[],
): Promise<readonly InvestigationStep[]> {
  if (labels.length === 0) {
    return [];
  }

  return withTenantContext(pool, organizationId, async (client) => {
    const values: string[] = [];
    const params: unknown[] = [organizationId, collaborationId];

    labels.forEach((label, index) => {
      const base = params.length;
      values.push(`($1, $2, $${base + 1}, $${base + 2})`);
      params.push(index, label);
    });

    const result = await client.query<InvestigationStepRow>(
      `insert into agent_investigation_steps (organization_id, collaboration_id, step_index, label)
       values ${values.join(", ")}
       returning ${STEP_COLUMNS}`,
      params,
    );

    return result.rows.map(toStep);
  });
}

/**
 * pending -> running for one step, the moment its own real work actually
 * begins. Guarded by `and status = 'pending'` so a retried/duplicate call
 * can never rewind a step that already finished — mirrors
 * `recordAgentCollaborationOutcome`'s atomic-claim doctrine, just without
 * needing the caller to branch on a `null` return (a step transition has no
 * competing outcome to fail closed against, so a no-op on a non-pending row
 * is the correct behavior, not an error).
 */
export async function startInvestigationStep(
  pool: DatabasePool,
  organizationId: string,
  collaborationId: string,
  stepIndex: number,
): Promise<void> {
  return withTenantContext(pool, organizationId, async (client) => {
    await client.query(
      `update agent_investigation_steps
       set status = 'running', started_at = now(), updated_at = now()
       where organization_id = $1 and collaboration_id = $2 and step_index = $3
         and status = 'pending'`,
      [organizationId, collaborationId, stepIndex],
    );
  });
}

/**
 * running -> done/failed for one step, the moment its own real work
 * actually settles. Guarded by `and status = 'running'` for the same
 * already-finished-stays-finished reason as `startInvestigationStep`.
 */
export async function completeInvestigationStep(
  pool: DatabasePool,
  organizationId: string,
  collaborationId: string,
  stepIndex: number,
  status: "done" | "failed",
): Promise<void> {
  return withTenantContext(pool, organizationId, async (client) => {
    await client.query(
      `update agent_investigation_steps
       set status = $4, completed_at = now(), updated_at = now()
       where organization_id = $1 and collaboration_id = $2 and step_index = $3
         and status = 'running'`,
      [organizationId, collaborationId, stepIndex, status],
    );
  });
}

/**
 * The Work Mat's one real read — polled every 1-2s while a collaboration
 * stays 'running' (apps/web's poll route). Ordered by step_index so the
 * client never has to re-sort a plan it already knows the intended order
 * of.
 */
export async function listInvestigationSteps(
  pool: DatabasePool,
  organizationId: string,
  collaborationId: string,
): Promise<readonly InvestigationStep[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<InvestigationStepRow>(
      `select ${STEP_COLUMNS} from agent_investigation_steps
       where organization_id = $1 and collaboration_id = $2
       order by step_index asc`,
      [organizationId, collaborationId],
    );

    return result.rows.map(toStep);
  });
}
