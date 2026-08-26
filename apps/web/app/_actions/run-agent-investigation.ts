"use server";

import { randomUUID } from "node:crypto";

import {
  composeCards,
  reconcileSpecialistResults,
  runParallelSpecialists,
  type SpecialistDomain,
} from "@signaldesk/application";
import { prioritizeFindings } from "@signaldesk/intelligence";
import {
  appendInvestigationSteps,
  completeAgentCollaboration,
  completeInvestigationStep,
  createDatabasePool,
  recordAuditEvent,
  startAgentCollaboration,
  startInvestigationStep,
  withAdvisoryLock,
  type DatabasePool,
} from "@signaldesk/persistence";

import type { RunAgentInvestigationActionResult } from "../_lib/actions";
import { isAgentFabricEnabled } from "../_lib/agent-config";
import { availabilityFor, providerFor } from "../_lib/agent-fabric";
import { createAgentGatewayService } from "../_lib/agent-gateway";
import { describeActionError } from "../_lib/describe-action-error";
import { classifyEvidenceSufficiency } from "../_lib/evidence-sufficiency";
import { logger } from "../_lib/logger";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import { getTodaysAttention } from "../_lib/todays-attention";
import { isValidUuid } from "../_lib/uuid";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * The Work Mat's step-progress tracking (docs/adr/0063-agent-investigation-progress.md)
 * is a real, but secondary, write — a failure here must never take down the
 * investigation itself, which worked before this feature existed and must
 * keep working exactly the same if a step-tracking write ever fails. Only
 * the incremental UI experience degrades; the final result is unaffected.
 */
async function recordStepSafely(
  organizationId: string,
  promise: Promise<unknown>,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.log("warn", `Investigation step tracking failed: ${message}`, {
      operation: "agent.investigation.step_tracking",
      organizationId,
    });
  }
}

/**
 * The Agent Fabric's one real trigger: "investigate risk" in the command
 * bar (see `matchAgentInvestigate`, deterministic-provider.ts) reaches here.
 * Re-derives real current findings via `getTodaysAttention` — the same
 * function `page.tsx` already uses — never trusting client-held state for
 * what to investigate. Every step is honest about doing nothing when
 * there's nothing real to do: the kill switch, an empty domain, and a
 * reconciler abstention all return a real message rather than a fabricated
 * card.
 *
 * `investigationId` is generated client-side (the Work Mat component, one
 * `crypto.randomUUID()` call) and becomes this collaboration's own primary
 * key — the one thing that lets the client start polling
 * `agent_investigation_steps` for real progress the instant it fires this
 * action, without a first round trip just to learn an id this
 * single-return-value Server Action otherwise couldn't hand back until the
 * whole investigation was already done (docs/adr/0063-agent-investigation-progress.md).
 * Validated up front rather than trusted: RLS and this row's own
 * organization-scoped uniqueness constraint are the real safety boundary,
 * but a clear "invalid id" is a better failure than an obscure Postgres
 * type error for a malformed value.
 */
export async function runAgentInvestigationAction(
  investigationId: string,
): Promise<RunAgentInvestigationActionResult> {
  try {
    if (!isValidUuid(investigationId)) {
      return { ok: false, error: "Invalid investigation id." };
    }

    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    const db = getPool();

    // Real observability for the deterministic gate itself — previously
    // this function returned early on every declined trigger with no
    // record of *why* an investigation didn't happen, so there was no way
    // to distinguish "AI is disabled" from "rate limited" from "nothing
    // material to investigate" after the fact (issue 12, `docs/25-issue-
    // audit.md`: "Zero-Prompt AI Cost/Triggering"). Reuses the existing
    // general-purpose `audit_events` trail rather than a new table —
    // `outcome: "denied"` mirrors how a policy-denied agent capability
    // check is already recorded (`agent-gateway.ts`).
    const recordDeclinedTrigger = (reason: string) =>
      recordAuditEvent(db, session.organizationId, {
        userId: session.userId,
        eventType: "agent.investigation.declined",
        subjectType: "organization",
        subjectId: session.organizationId,
        outcome: "denied",
        metadata: { reason },
      });

    if (!isAgentFabricEnabled()) {
      await recordDeclinedTrigger("agent_fabric_disabled");
      return {
        ok: true,
        card: null,
        message: "AI investigation is not enabled for this organization.",
      };
    }

    const rateLimit = await checkRateLimit(
      db,
      `agent-investigate:${session.organizationId}`,
      3,
      5 * 60 * 1000,
    );

    if (!rateLimit.allowed) {
      await recordDeclinedTrigger("rate_limited");
      return {
        ok: false,
        error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before investigating again.`,
      };
    }

    const now = new Date();
    const attention = await getTodaysAttention(session, now);
    const financeFindings = attention.findings.filter(
      (finding) => finding.type === "invoice.overdue",
    );
    const deliveryFindings = attention.findings.filter(
      (finding) => finding.type === "task.overdue",
    );
    const ticketFindings = attention.findings.filter(
      (finding) => finding.type === "ticket.stuck",
    );

    // A real, deterministic evidence-sufficiency check *before* the model
    // ever sees anything — SignalDesk decides whether there's enough real
    // evidence to investigate, rather than trusting the model's own
    // self-reported confidence to catch an evidence gap after the call
    // (see `evidence-sufficiency.ts`'s doc comment for why this exists).
    const evidenceSufficiency = classifyEvidenceSufficiency([
      ...financeFindings,
      ...deliveryFindings,
      ...ticketFindings,
    ]);

    if (evidenceSufficiency === "missing") {
      await recordDeclinedTrigger("no_material_findings");
      return {
        ok: true,
        card: null,
        message: "Nothing to investigate right now.",
      };
    }

    if (evidenceSufficiency === "stale") {
      await recordDeclinedTrigger("evidence_stale");
      return {
        ok: true,
        card: null,
        message:
          "The evidence behind current findings hasn't refreshed recently enough to investigate confidently right now.",
      };
    }

    // A real, cross-instance Postgres advisory lock (`withAdvisoryLock`,
    // same primitive `start-checkout.ts` uses for its own double-submit
    // guard). Without it, two near-simultaneous triggers (a double-click,
    // or a client retry after a slow response) both pass the rate-limit
    // check above and each start a real, independent collaboration —
    // `agent_collaborations_org_idempotency_unique` exists specifically to
    // prevent that, but only if a repeated request carries a repeatable
    // key; a command-bar trigger has no natural stable key to dedupe on
    // the way a checkout has a plan/interval, so a per-organization lock
    // is the right primitive here instead. `randomUUID()` below is still
    // correct for `idempotencyKey` itself (real, unique, satisfies the
    // column's NOT NULL/non-empty constraint) — the lock is what actually
    // prevents the double-run this key alone can't.
    const lockResult = await withAdvisoryLock(
      db,
      `agent-investigate-lock:${session.organizationId}`,
      async (): Promise<RunAgentInvestigationActionResult> => {
        const collaboration = await startAgentCollaboration(
          db,
          session.organizationId,
          {
            id: investigationId,
            userId: session.userId,
            pattern: "parallel_specialists",
            objective:
              "Investigate current finance, delivery, and ticket risk.",
            correlationId: randomUUID(),
            idempotencyKey: randomUUID(),
          },
        );

        // The Work Mat's step plan — one label per domain that actually has
        // real findings to check (never a fabricated fixed list), plus the
        // reconciliation step every real run reaches. Declared all up front,
        // 'pending', so the client sees the whole real plan immediately and
        // fills in status as each step genuinely starts/settles.
        const domainStepIndex = new Map<SpecialistDomain, number>();
        const stepLabels: string[] = [];

        if (financeFindings.length > 0) {
          domainStepIndex.set("finance", stepLabels.length);
          stepLabels.push("Checking overdue invoices…");
        }
        if (deliveryFindings.length > 0) {
          domainStepIndex.set("delivery", stepLabels.length);
          stepLabels.push("Checking overdue tasks…");
        }
        if (ticketFindings.length > 0) {
          domainStepIndex.set("ticket", stepLabels.length);
          stepLabels.push("Checking stuck support tickets…");
        }

        const reconcileStepIndex = stepLabels.length;
        stepLabels.push("Reconciling findings…");

        await recordStepSafely(
          session.organizationId,
          appendInvestigationSteps(
            db,
            session.organizationId,
            collaboration.id,
            stepLabels,
          ),
        );
        await Promise.all(
          [...domainStepIndex.values()].map((index) =>
            recordStepSafely(
              session.organizationId,
              startInvestigationStep(
                db,
                session.organizationId,
                collaboration.id,
                index,
              ),
            ),
          ),
        );

        const gateway = createAgentGatewayService({
          pool: db,
          organizationId: session.organizationId,
          collaborationId: collaboration.id,
          providerFor: (agentId) =>
            providerFor(agentId, session.organizationId, db),
        });

        const results = await runParallelSpecialists(
          { findings: financeFindings },
          { findings: deliveryFindings },
          { findings: ticketFindings },
          availabilityFor(),
          gateway.dispatch,
          (domain, result) => {
            const index = domainStepIndex.get(domain);

            if (index === undefined) {
              return;
            }

            void recordStepSafely(
              session.organizationId,
              completeInvestigationStep(
                db,
                session.organizationId,
                collaboration.id,
                index,
                result !== null && result.status !== "failed"
                  ? "done"
                  : "failed",
              ),
            );
          },
        );

        await recordStepSafely(
          session.organizationId,
          startInvestigationStep(
            db,
            session.organizationId,
            collaboration.id,
            reconcileStepIndex,
          ),
        );

        const { finding: reconciled, contradictionsDetected } =
          reconcileSpecialistResults(results, [
            ...financeFindings,
            ...deliveryFindings,
            ...ticketFindings,
          ]);

        await recordStepSafely(
          session.organizationId,
          completeInvestigationStep(
            db,
            session.organizationId,
            collaboration.id,
            reconcileStepIndex,
            reconciled ? "done" : "failed",
          ),
        );

        await completeAgentCollaboration(
          db,
          session.organizationId,
          collaboration.id,
          {
            status: reconciled ? "completed" : "failed",
            reconciledSummary: reconciled?.summary ?? null,
            reconciledConfidenceBasisPoints:
              reconciled === null
                ? null
                : Math.round(reconciled.confidence * 10_000),
            contradictionsDetected,
          },
        );

        if (!reconciled) {
          return {
            ok: true,
            card: null,
            message: "No confident recommendation from this investigation.",
          };
        }

        // The card's id becomes the real agent_collaborations.id
        // (overriding the reconciler's synthetic one) — this is what lets
        // the client pass card.id straight back as collaborationId when
        // the user clicks Approve/Dismiss, with no extra field needed on
        // the card schema.
        const collaborationFinding = { ...reconciled, id: collaboration.id };
        const prioritized = prioritizeFindings([
          ...attention.findings,
          collaborationFinding,
        ]);
        const cards = composeCards(prioritized);
        const card =
          cards.find((candidate) => candidate.id === collaboration.id) ?? null;

        return {
          ok: true,
          card,
          message: "Investigation complete.",
        };
      },
    );

    if (lockResult === null) {
      await recordDeclinedTrigger("investigation_already_running");
      return {
        ok: true,
        card: null,
        message:
          "An investigation is already running for this workspace. Please wait a moment and try again.",
      };
    }

    return lockResult;
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to run the investigation."),
    };
  }
}
