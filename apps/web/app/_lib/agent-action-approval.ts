import {
  recordAgentCollaborationOutcome,
  recordAuditEvent,
  resetAgentCollaborationOutcome,
  type DatabasePool,
  type RecordAuditEventInput,
} from "@signaldesk/persistence";
import type { EntityReference } from "@signaldesk/schemas";

import type {
  IntelligenceFinding,
  IntelligenceType,
} from "@signaldesk/intelligence";

import { errorReporter } from "./error-reporter";

/**
 * Shared, low-risk sub-steps for the approve half of every draft-then-
 * approve write action (ADR 0056's Gmail reply, ADR 0057's QuickBooks/
 * Asana/HubSpot/Zendesk equivalents) — deliberately NOT a single generic
 * orchestrator the way `draft-entity-content-action.ts` is for the draft
 * half. The two hardest, most consequential pieces of an approve action —
 * resume-vs-fresh-approval branching and provider-error classification
 * (definite rejection vs. ambiguous, safe-to-retry vs. not) — stay in each
 * connector's own `approve-*-action.ts`, since none of the four providers'
 * write-endpoint idempotency guarantees are the same, and forcing them
 * through one generic config would risk silently applying Gmail-shaped
 * assumptions to a provider where they don't hold. This file only extracts
 * the pieces that carry no such risk: pure branching logic and thin
 * wrappers around the existing atomic-claim/compensating-rollback
 * persistence primitives.
 */

export type CollaborationApprovalPath =
  | { readonly kind: "fresh" }
  | { readonly kind: "resume" }
  | { readonly kind: "blocked"; readonly error: string };

/**
 * Decides whether an approve action is looking at a brand-new approval, a
 * resume of one already claimed but never confirmed complete (a prior call
 * claimed the outcome, began the real send/post, then failed or was
 * interrupted before returning), or something that must be blocked outright
 * (missing collaboration/entity/drafted content, or already dismissed).
 * Mirrors `approveMessageReplyProposalAction`'s own inline branching
 * exactly — extracted so it isn't re-derived slightly differently per
 * connector.
 */
export function decideCollaborationApprovalPath(
  collaboration: { readonly outcome: "approved" | "dismissed" | null } | null,
  entityId: string | null,
  hasDraftedContent: boolean,
): CollaborationApprovalPath {
  if (!collaboration || !entityId || !hasDraftedContent) {
    return {
      kind: "blocked",
      error: "This recommendation is no longer available.",
    };
  }

  if (collaboration.outcome === "dismissed") {
    return {
      kind: "blocked",
      error: "This recommendation was already dismissed.",
    };
  }

  if (collaboration.outcome === "approved") {
    return { kind: "resume" };
  }

  return { kind: "fresh" };
}

/** Whether the deterministic finding this collaboration drafted from is
 * still live in the caller's freshly re-fetched attention findings — the
 * same re-verification-at-approval-time discipline every existing approve
 * action already applies, generalized over which finding/entity type. */
export function isFindingStillLive(
  findings: readonly IntelligenceFinding[],
  findingType: IntelligenceType,
  entityKind: EntityReference["kind"],
  entityId: string,
): boolean {
  return findings.some(
    (finding) =>
      finding.type === findingType &&
      finding.entity?.kind === entityKind &&
      finding.entity.id === entityId,
  );
}

/** The repeated "record why a fresh approval was blocked" audit-event
 * shape every existing approve action writes 1-2 times (stale finding,
 * stale evidence, volume limit). */
export async function recordApprovalBlocked(
  db: DatabasePool,
  organizationId: string,
  userId: string,
  collaborationId: string,
  reason: string,
): Promise<void> {
  await recordAuditEvent(db, organizationId, {
    userId,
    eventType: "agent_action_proposal.approval_blocked",
    subjectType: "agent_collaboration",
    subjectId: collaborationId,
    outcome: "denied",
    metadata: { reason },
  });
}

export type ClaimApprovalResult =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

/** Thin wrapper around the existing atomic-claim primitive
 * (`recordAgentCollaborationOutcome`) — only ever succeeds once per
 * collaboration (the `and outcome is null` guard inside it), so a second
 * concurrent approval attempt fails closed with an honest "already
 * reviewed" rather than double-claiming. */
export async function claimApprovalOrFail(
  db: DatabasePool,
  organizationId: string,
  collaborationId: string,
): Promise<ClaimApprovalResult> {
  const claimed = await recordAgentCollaborationOutcome(
    db,
    organizationId,
    collaborationId,
    "approved",
  );

  if (!claimed) {
    return { ok: false, error: "This recommendation was already reviewed." };
  }

  return { ok: true };
}

/** Runs `fn` (the real send/post attempt) after a successful claim; on any
 * thrown error, resets the claim back to unreviewed
 * (`resetAgentCollaborationOutcome`) before rethrowing, so a send that never
 * even started (an entity failed to load, a token refresh threw) never
 * leaves the collaboration permanently claimed with no real effect and no
 * way to retry. Deliberately used only around the send attempt itself, not
 * around the audit-event write that follows it — see
 * `recordApprovalAuditEvent`'s own doc comment for why those two steps need
 * different failure handling, a real bug this file's own history got wrong
 * before it was split into two helpers. */
export async function withApprovalRollback<T>(
  db: DatabasePool,
  organizationId: string,
  collaborationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    await resetAgentCollaborationOutcome(db, organizationId, collaborationId);
    throw error;
  }
}

/**
 * Records the final `agent_action_proposal.approved` audit event after the
 * send attempt has already returned — deliberately NOT wrapped in
 * `withApprovalRollback`. By this point `attemptSend`'s real result is
 * already a settled fact: it either genuinely reached the provider (sent or
 * a definite rejection) or `withApprovalRollback` already reset the claim
 * for a send that never happened. A transient failure recording *this*
 * audit event must never also reset the claim — doing so would let a
 * subsequent approval attempt go through `decideCollaborationApprovalPath`
 * as `"fresh"` instead of `"resume"`, re-running every gate (rate limit,
 * evidence sufficiency, the Pre-Flight Policy Audit's duplicate-send-window
 * check) against a collaboration that, in the successful case, already has
 * a real external effect on record — at best a confusing "already sent
 * recently" denial, at worst (were it not for the send-tracking table's own
 * idempotency key) grounds for a second real send. The collaboration's
 * claimed state must track "was this reviewed," not "did this specific
 * audit write also succeed." A failure here is reported so it isn't
 * silently lost, but the caller's already-real result is still returned to
 * the user as-is.
 */
export async function recordApprovalAuditEvent(
  db: DatabasePool,
  organizationId: string,
  input: RecordAuditEventInput,
): Promise<void> {
  try {
    await recordAuditEvent(db, organizationId, input);
  } catch (error) {
    errorReporter.captureException(error, {
      operation: "agent_action_approval.record_audit_event",
      organizationId,
      correlationId: input.subjectId,
    });
  }
}
