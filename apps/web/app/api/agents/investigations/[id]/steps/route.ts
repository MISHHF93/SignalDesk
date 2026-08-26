import { NextResponse } from "next/server";

import {
  createDatabasePool,
  getAgentCollaboration,
  listInvestigationSteps,
  type DatabasePool,
} from "@signaldesk/persistence";

import { describeActionError } from "../../../../../_lib/describe-action-error";
import { checkRateLimit } from "../../../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../../../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * The Work Mat's one real read (docs/adr/0063-agent-investigation-progress.md):
 * polled every 1-2s by `useInvestigationSteps` for as long as one
 * investigation stays 'running', so the client can show real, incremental
 * step progress for a Server Action (`runAgentInvestigationAction`) that
 * itself only ever returns once, at the very end. `id` is the client-
 * generated collaboration id that action was called with — both reads are
 * already tenant-scoped (RLS + an explicit `organization_id` match), so a
 * guessed or cross-tenant id returns 404, never another organization's
 * progress.
 *
 * Rate-limited higher than business/snapshot's 30/min (this route's own
 * precedent for a client-polled endpoint): `useInvestigationSteps` polls
 * every 200ms, and a single investigation's real worst case (the
 * model-backed specialist's own 30s timeBudgetMs) could reach roughly 150
 * polls — 300/min leaves comfortable headroom for that plus a second
 * investigation started in the same window, while still bounding a
 * scripted hammering of the endpoint.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.json({ error: "Sign in to do this." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(
    getPool(),
    `agent-investigation-steps:${session.organizationId}`,
    300,
    60 * 1000,
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const { id } = await params;

  try {
    const db = getPool();
    const collaboration = await getAgentCollaboration(
      db,
      session.organizationId,
      id,
    );

    if (!collaboration) {
      return NextResponse.json(
        { error: "Investigation not found." },
        { status: 404 },
      );
    }

    const steps = await listInvestigationSteps(db, session.organizationId, id);

    return NextResponse.json({
      status: collaboration.status,
      steps: steps.map((step) => ({
        stepIndex: step.stepIndex,
        label: step.label,
        status: step.status,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeActionError(
          error,
          "Failed to load investigation progress.",
          { organizationId: session.organizationId },
        ),
      },
      { status: 500 },
    );
  }
}
