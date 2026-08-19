"use server";

import {
  createDatabasePool,
  createInternalTask,
} from "@business-dashboard/persistence";
import {
  parseCreateInternalTaskInput,
  type CreateInternalTaskInput,
} from "@business-dashboard/schemas";

import type { CreateInternalTaskActionResult } from "../_lib/actions";
import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

// Module-scoped so the pool is reused across invocations within one server
// process rather than opened per request.
let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * The safe action: a verified database write scoped to the caller's actual
 * organization. `organizationId` is never accepted as an argument — it is
 * derived exclusively from the authenticated session
 * (`getCurrentOrganization`), consistent with ADR 0005 and the Next.js
 * guidance that a well-formed request object can still refer to a row the
 * caller does not own.
 */
export async function createInternalTaskAction(
  input: CreateInternalTaskInput,
): Promise<CreateInternalTaskActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    const validated = parseCreateInternalTaskInput(input);
    const task = await createInternalTask(
      getPool(),
      session.organizationId,
      session.userId,
      validated,
    );

    return {
      ok: true,
      task: {
        id: task.id,
        title: task.title,
        createdAt: task.createdAt.toISOString(),
        created: task.created,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to create the task."),
    };
  }
}
