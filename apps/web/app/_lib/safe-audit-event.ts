import {
  recordAuditEvent,
  type DatabasePool,
  type RecordAuditEventInput,
} from "@signaldesk/persistence";

import { errorReporter } from "./error-reporter";

/**
 * Records an audit event without letting a failure here corrupt an
 * already-real result the caller already has by the time this runs. A
 * real, repeated bug found by review across every billing Server Action
 * that ends with a trailing `recordAuditEvent` call right after its real
 * Stripe mutation (and local DB write) already succeeded — a transient
 * failure recording *this* event (a connection blip, a constraint
 * hiccup) doesn't mean the real action failed, but the raw call sat
 * inside the same try/catch that would report "Failed to cancel/resume/
 * change/add that" regardless, discarding a real success. Same reasoning
 * `recordApprovalAuditEvent` (`agent-action-approval.ts`) already applies
 * to the Agent Fabric's own approve actions, and
 * `recordPromoRedemptionSafely` (`start-checkout.ts`) applies to that
 * file's own non-critical follow-up write — this is the version shared
 * by every plain `recordAuditEvent` call site that fits the same shape.
 * A failure here is reported so it isn't silently lost.
 */
export async function recordAuditEventSafely(
  db: DatabasePool,
  organizationId: string,
  input: RecordAuditEventInput,
): Promise<void> {
  try {
    await recordAuditEvent(db, organizationId, input);
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "billing_action.record_audit_event",
      organizationId,
      correlationId: input.subjectId,
    });
  }
}
