"use server";

import { randomUUID } from "node:crypto";

import {
  composeCards,
  reconcileSpecialistResults,
  runParallelSpecialists,
} from "@signaldesk/application";
import { prioritizeFindings } from "@signaldesk/intelligence";
import {
  completeAgentCollaboration,
  createDatabasePool,
  recordAuditEvent,
  startAgentCollaboration,
  type DatabasePool,
} from "@signaldesk/persistence";

import type { RunAgentInvestigationActionResult } from "../_lib/actions";
import { isAgentFabricEnabled } from "../_lib/agent-config";
import { availabilityFor, providerFor } from "../_lib/agent-fabric";
import { createAgentGatewayService } from "../_lib/agent-gateway";
import { describeActionError } from "../_lib/describe-action-error";
import { classifyEvidenceSufficiency } from "../_lib/evidence-sufficiency";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import { getTodaysAttention } from "../_lib/todays-attention";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
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
 */
export async function runAgentInvestigationAction(): Promise<RunAgentInvestigationActionResult> {
  try {
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

    // A real, deterministic evidence-sufficiency check *before* the model
    // ever sees anything — SignalDesk decides whether there's enough real
    // evidence to investigate, rather than trusting the model's own
    // self-reported confidence to catch an evidence gap after the call
    // (see `evidence-sufficiency.ts`'s doc comment for why this exists).
    const evidenceSufficiency = classifyEvidenceSufficiency([
      ...financeFindings,
      ...deliveryFindings,
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

    const collaboration = await startAgentCollaboration(
      db,
      session.organizationId,
      {
        userId: session.userId,
        pattern: "parallel_specialists",
        objective: "Investigate current finance and delivery risk.",
        correlationId: randomUUID(),
        idempotencyKey: randomUUID(),
      },
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
      availabilityFor(),
      gateway.dispatch,
    );

    const { finding: reconciled, contradictionsDetected } =
      reconcileSpecialistResults(results, [
        ...financeFindings,
        ...deliveryFindings,
      ]);

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

    // The card's id becomes the real agent_collaborations.id (overriding
    // the reconciler's synthetic one) — this is what lets the client pass
    // card.id straight back as collaborationId when the user clicks
    // Approve/Dismiss, with no extra field needed on the card schema.
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
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to run the investigation."),
    };
  }
}
