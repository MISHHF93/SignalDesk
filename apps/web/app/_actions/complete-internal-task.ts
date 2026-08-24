"use server";

import {
  completeInternalTask,
  createDatabasePool,
} from "@signaldesk/persistence";
import {
  parseCompleteInternalTaskInput,
  type CompleteInternalTaskInput,
} from "@signaldesk/schemas";

import type { CompleteInternalTaskActionResult } from "../_lib/actions";
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
 * The safe action's other real write: marks one of the caller's own
 * internal tasks completed. Follows `createInternalTaskAction`'s exact
 * shape — `organizationId` is never accepted as an argument, only ever
 * derived from the authenticated session, consistent with ADR 0005.
 */
export async function completeInternalTaskAction(
  input: CompleteInternalTaskInput,
): Promise<CompleteInternalTaskActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    const validated = parseCompleteInternalTaskInput(input);
    const task = await completeInternalTask(
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
        updated: task.updated,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to complete the task."),
    };
  }
}
