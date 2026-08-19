import { evaluateOverdueTask } from "@business-dashboard/domain";

import type {
  IntelligenceCapability,
  IntelligenceContext,
} from "../capability";
import { CONFIDENCE_DETERMINISTIC_RULE } from "../confidence";
import type { IntelligenceFinding } from "../finding";
import { freshnessStatus } from "../format";

/**
 * Delivery-risk framing of Asana tasks: which incomplete tasks have passed
 * their due date. Mirrors `overdue-invoice.ts` exactly — evaluates every
 * overdue task in `context.overdueTasks`, not just one, since each is an
 * independent risk item.
 */
export const overdueTaskIntelligence: IntelligenceCapability = {
  id: "overdue-task",
  description: "Detects incomplete tasks that have passed their due date.",
  async evaluate(
    context: IntelligenceContext,
  ): Promise<readonly IntelligenceFinding[]> {
    const { overdueTasks, now } = context;
    const findings: IntelligenceFinding[] = [];

    for (const task of overdueTasks) {
      const signal = evaluateOverdueTask(task, now);

      if (!signal) {
        continue;
      }

      const sourceFreshnessMinutes = Math.max(
        0,
        Math.floor(
          (now.getTime() - task.source.lastSyncedAt.getTime()) / 60_000,
        ),
      );

      findings.push({
        id: `overdue-task:${task.organizationId}:${task.id}`,
        type: "task.overdue",
        entity: { kind: "task", id: task.id },
        title: `"${task.name}" overdue`,
        summary: signal.explanation,
        severity: signal.severity,
        confidence: CONFIDENCE_DETERMINISTIC_RULE,
        // The assignee's Asana gid isn't persisted (only their display
        // name — see the `tasks` table/mapper) — a known simplification,
        // so the name doubles as the owner id here rather than leaving
        // this card the only one with no owner reference at all.
        ...(task.assigneeName
          ? { owner: { id: task.assigneeName, name: task.assigneeName } }
          : {}),
        evidence: signal.evidence.map((reference) => ({ ...reference })),
        freshness: {
          asOf: task.source.lastSyncedAt,
          status: freshnessStatus(sourceFreshnessMinutes),
        },
        explanation: {
          trigger: "Task remained incomplete past its due date.",
          observedValue: `${signal.daysOverdue} day${signal.daysOverdue === 1 ? "" : "s"} overdue`,
          expectedBaseline: "Completed by due date",
          confidence: "high",
        },
        recommendedActionTypes: ["create_internal_task"],
        detectedAt: now,
      });
    }

    return findings;
  },
};
