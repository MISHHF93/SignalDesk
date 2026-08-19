import {
  evaluateUntouchedLead,
  type Lead,
  type StuckLeadSignal,
} from "@signaldesk/domain";

export type LeadAttentionResult =
  | {
      readonly requiresAttention: false;
      readonly lead: Lead;
      readonly sourceFreshnessMinutes: number;
    }
  | {
      readonly requiresAttention: true;
      readonly lead: Lead;
      readonly signal: StuckLeadSignal;
      readonly sourceFreshnessMinutes: number;
    };

export function getLeadAttention(
  lead: Lead,
  now: Date,
  criticalValueCents: number,
  workingDaysBitmask: number,
  timeZone: string,
): LeadAttentionResult {
  if (!Number.isFinite(now.getTime())) {
    throw new RangeError("The evaluation time must be a valid date.");
  }

  const sourceAgeMilliseconds =
    now.getTime() - lead.source.lastSyncedAt.getTime();
  const sourceFreshnessMinutes = Math.max(
    0,
    Math.floor(sourceAgeMilliseconds / 60_000),
  );
  const signal = evaluateUntouchedLead(
    lead,
    now,
    criticalValueCents,
    workingDaysBitmask,
    timeZone,
  );

  if (signal === null) {
    return {
      requiresAttention: false,
      lead,
      sourceFreshnessMinutes,
    };
  }

  return {
    requiresAttention: true,
    lead,
    signal,
    sourceFreshnessMinutes,
  };
}
