"use server";

import { createDatabasePool, createGoal } from "@signaldesk/persistence";
import {
  parseCreateGoalInput,
  type CreateGoalInput,
} from "@signaldesk/schemas";
import { getMetricDefinition } from "@signaldesk/semantics";

import type { CreateGoalActionResult } from "../_lib/actions";
import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * The Goal Intelligence Engine's one real write (Prompt 22,
 * docs/product-vision-backlog.md, ADR 0035) — mirrors
 * `createInternalTaskAction` exactly: `organizationId` is never accepted
 * as an argument, derived only from the authenticated session.
 *
 * Validates that `currency` is present exactly when the target metric's
 * unit is `"currency"` — the one check `createGoalInputSchema` can't do
 * itself (it deliberately has no dependency on `@signaldesk/semantics`'
 * catalog, see that schema's own doc comment), so it happens here instead
 * of at the database boundary.
 */
export async function createGoalAction(
  input: CreateGoalInput,
): Promise<CreateGoalActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    const validated = parseCreateGoalInput(input);
    const definition = getMetricDefinition(validated.metricId);

    if (!definition) {
      return { ok: false, error: "Unknown metric." };
    }

    const currencyRequired = definition.unit === "currency";

    if (currencyRequired && validated.currency === null) {
      return {
        ok: false,
        error: `${definition.name} is a currency metric — choose a currency.`,
      };
    }

    if (!currencyRequired && validated.currency !== null) {
      return {
        ok: false,
        error: `${definition.name} is a count, not a currency amount.`,
      };
    }

    const goal = await createGoal(getPool(), session.organizationId, {
      userId: session.userId,
      metricId: validated.metricId,
      name: validated.name,
      comparisonOperator: validated.comparisonOperator,
      targetValue: validated.targetValue,
      currency: validated.currency,
      idempotencyKey: validated.idempotencyKey,
    });

    return {
      ok: true,
      goal: {
        id: goal.id,
        name: goal.name,
        metricId: goal.metricId,
        createdAt: goal.createdAt.toISOString(),
        created: goal.created,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to create the goal."),
    };
  }
}
