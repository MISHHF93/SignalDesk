// Matches createInternalTaskInputSchema's title cap
// (packages/schemas/src/index.ts) — kept as a plain constant rather than
// introspected from the Zod schema at runtime, since ZodString's
// `.maxLength` is not documented public API.
const MAX_TASK_TITLE_LENGTH = 200;
const ELLIPSIS = "…";

/**
 * Builds a task title from a fixed prefix and a card's title, truncating to
 * fit createInternalTaskInputSchema's 200-character cap. Card titles can
 * legitimately be far longer than that: they're built from external-system
 * free text like a HubSpot contact or company name, which
 * `sourceLeadRecordSchema` allows up to 500 characters each (its own
 * comment: "a source system's own field limits are not a security control
 * this app can rely on"). Without truncating here, a long lead name would
 * make the "create follow-up task" action fail with a raw Zod validation
 * error instead of creating a (sensibly shortened) task.
 */
export function buildTaskTitle(prefix: string, cardTitle: string): string {
  const combined = `${prefix}: ${cardTitle}`;

  if (combined.length <= MAX_TASK_TITLE_LENGTH) {
    return combined;
  }

  return `${combined.slice(0, MAX_TASK_TITLE_LENGTH - ELLIPSIS.length)}${ELLIPSIS}`;
}
