export interface SourceReference {
  readonly integrationId: string;
  readonly system: string;
  readonly externalRecordId: string;
  readonly sourceVersion: string;
  readonly recordDigestSha256: string;
  readonly lastSyncedAt: Date;
}

export interface LeadOwner {
  readonly id: string;
  readonly name: string;
}

export interface Lead {
  readonly id: string;
  readonly organizationId: string;
  readonly contactName: string;
  readonly companyName: string;
  readonly valueCents: number;
  readonly currency: string;
  /** `null` when the lead has no assigned owner (see the Ownership Intelligence capability). */
  readonly owner: LeadOwner | null;
  readonly stage: string;
  readonly createdAt: Date;
  readonly lastInteractionAt: Date | null;
  readonly expectedResponseHours: number;
  readonly source: SourceReference;
}

export interface Invoice {
  readonly id: string;
  readonly organizationId: string;
  readonly customerName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly dueAt: Date;
  /** Only `"open"` invoices are ever ingested today (the QuickBooks query
   * that feeds this filters on `Balance > 0`) — `"paid"`/`"void"` exist in
   * the type for when a real re-sync path exists to observe a status
   * transition, not because anything produces them yet. */
  readonly status: "open" | "paid" | "void";
  readonly source: SourceReference;
}

export interface OverdueInvoiceSignal {
  readonly id: string;
  readonly type: "invoice.overdue";
  readonly invoiceId: string;
  readonly organizationId: string;
  readonly severity: "high" | "critical";
  readonly daysOverdue: number;
  readonly amountCents: number;
  readonly currency: string;
  readonly explanation: string;
  readonly recommendedAction: string;
  readonly evidence: readonly SourceReference[];
}

export interface Task {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  /** `null` when the source task has no assignee — Asana tasks queried by
   * `assignee=<connected user>` are always assigned to someone by
   * construction today, but a future provider (or a reassigned task) may
   * not carry a name reliably, so this stays honestly nullable. */
  readonly assigneeName: string | null;
  readonly dueAt: Date;
  readonly completed: boolean;
  readonly source: SourceReference;
}

export interface OverdueTaskSignal {
  readonly id: string;
  readonly type: "task.overdue";
  readonly taskId: string;
  readonly organizationId: string;
  readonly severity: "high" | "critical";
  readonly daysOverdue: number;
  readonly explanation: string;
  readonly recommendedAction: string;
  readonly evidence: readonly SourceReference[];
}

export interface StuckLeadSignal {
  readonly id: string;
  readonly type: "lead.untouched";
  readonly leadId: string;
  readonly organizationId: string;
  readonly severity: "high" | "critical";
  readonly elapsedHours: number;
  readonly thresholdHours: number;
  readonly businessImpactCents: number;
  readonly currency: string;
  readonly explanation: string;
  readonly recommendedAction: string;
  readonly evidence: readonly SourceReference[];
}

const MILLISECONDS_PER_HOUR = 60 * 60 * 1_000;
/** Fallback only — real callers pass the organization's own threshold
 * (`OrganizationBusinessProfile.highValueThresholdCents`,
 * `@business-dashboard/persistence`) rather than relying on this. */
const DEFAULT_CRITICAL_VALUE_CENTS = 1_000_000;

/**
 * Bit `n` (0 = Sunday, matching `Date.getUTCDay()`) set means day `n` is a
 * working day. Fallback only, like `DEFAULT_CRITICAL_VALUE_CENTS` above —
 * counts every day as a working day, i.e. today's pre-business-hours-aware
 * behavior, unchanged. Real callers pass the organization's own
 * `OrganizationBusinessProfile.workingDaysBitmask`.
 */
const ALL_DAYS_BITMASK = 0b1111111;

const WEEKDAY_ABBREVIATION_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function isWorkingDay(
  timestamp: Date,
  workingDaysBitmask: number,
  timeZone: string,
): boolean {
  const abbreviation = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(timestamp);
  const dayIndex = WEEKDAY_ABBREVIATION_INDEX[abbreviation];

  return dayIndex !== undefined && (workingDaysBitmask & (1 << dayIndex)) !== 0;
}

/**
 * Elapsed time counted only across the organization's own working days, in
 * its own local timezone — not every day between `start` and `end`. A
 * Mon-Fri business's Friday-evening lead should not read as having sat
 * untouched for a full weekend by Monday morning; a lead created Friday
 * 6pm and still untouched Monday 10am has genuinely had ~16 business hours
 * to be missed, not the ~64 raw wall-clock hours that have actually
 * passed. Hour-granularity, not minute-granularity: this models which
 * *days* count, not hour-of-day business hours (e.g. 9-5) — a coarser but
 * still meaningfully more honest measure than pure wall-clock time.
 */
function elapsedBusinessHours(
  start: Date,
  end: Date,
  workingDaysBitmask: number,
  timeZone: string,
): number {
  const totalWholeHours = Math.floor(
    (end.getTime() - start.getTime()) / MILLISECONDS_PER_HOUR,
  );
  const fractionalHour =
    (end.getTime() - start.getTime()) / MILLISECONDS_PER_HOUR - totalWholeHours;

  let businessHours = 0;

  for (let hour = 0; hour < totalWholeHours; hour += 1) {
    const hourStart = new Date(start.getTime() + hour * MILLISECONDS_PER_HOUR);

    if (isWorkingDay(hourStart, workingDaysBitmask, timeZone)) {
      businessHours += 1;
    }
  }

  // The trailing partial hour counts iff it falls on a working day too —
  // matters for "surfaces a lead exactly at the response threshold"-style
  // boundary checks to keep working with fractional elapsed durations.
  if (
    fractionalHour > 0 &&
    isWorkingDay(
      new Date(start.getTime() + totalWholeHours * MILLISECONDS_PER_HOUR),
      workingDaysBitmask,
      timeZone,
    )
  ) {
    businessHours += fractionalHour;
  }

  return businessHours;
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

function isValidInvoiceForEvaluation(invoice: Invoice, now: Date): boolean {
  return (
    isValidDate(now) &&
    isValidDate(invoice.dueAt) &&
    isValidDate(invoice.source.lastSyncedAt) &&
    Number.isFinite(invoice.amountCents) &&
    Number.isInteger(invoice.amountCents) &&
    invoice.amountCents >= 0
  );
}

/**
 * Evaluates the deterministic rule: an invoice is overdue when it is still
 * `open` and its due date has passed, regardless of day of week — unlike
 * lead follow-up, a receivable doesn't stop being overdue on a weekend, so
 * this deliberately uses raw calendar time rather than
 * `elapsedBusinessHours`.
 *
 * `criticalValueCents` decides the "critical" vs. "high" severity split,
 * mirroring `evaluateUntouchedLead`'s own threshold — real callers should
 * pass the organization's own configured threshold, not the fallback.
 */
export function evaluateOverdueInvoice(
  invoice: Invoice,
  now: Date,
  criticalValueCents: number = DEFAULT_CRITICAL_VALUE_CENTS,
): OverdueInvoiceSignal | null {
  if (!isValidInvoiceForEvaluation(invoice, now)) {
    return null;
  }

  if (invoice.status !== "open") {
    return null;
  }

  const elapsedMilliseconds = now.getTime() - invoice.dueAt.getTime();

  if (elapsedMilliseconds < 0) {
    return null;
  }

  const daysOverdue = Math.floor(elapsedMilliseconds / MILLISECONDS_PER_DAY);

  return {
    id: `invoice.overdue:${invoice.organizationId}:${invoice.id}`,
    type: "invoice.overdue",
    invoiceId: invoice.id,
    organizationId: invoice.organizationId,
    severity: invoice.amountCents >= criticalValueCents ? "critical" : "high",
    daysOverdue,
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    explanation: `Invoice for ${invoice.customerName} is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} past its due date and still unpaid.`,
    recommendedAction: `Follow up with ${invoice.customerName} about the outstanding balance.`,
    evidence: [
      {
        integrationId: invoice.source.integrationId,
        system: invoice.source.system,
        externalRecordId: invoice.source.externalRecordId,
        sourceVersion: invoice.source.sourceVersion,
        recordDigestSha256: invoice.source.recordDigestSha256,
        lastSyncedAt: new Date(invoice.source.lastSyncedAt.getTime()),
      },
    ],
  };
}

const DEFAULT_CRITICAL_DAYS_OVERDUE = 7;

function isValidTaskForEvaluation(task: Task, now: Date): boolean {
  return (
    isValidDate(now) &&
    isValidDate(task.dueAt) &&
    isValidDate(task.source.lastSyncedAt)
  );
}

/**
 * Evaluates the deterministic rule: a task is overdue when it is still
 * incomplete and its due date has passed — the same raw-calendar-time
 * reasoning as `evaluateOverdueInvoice` (a task doesn't stop being late on
 * a weekend). Unlike leads/invoices, a task has no natural dollar value to
 * threshold severity against, so `criticalDaysOverdue` (default 7) is the
 * severity boundary instead — real callers may eventually want an
 * organization-configured value, but there is no per-org setting for this
 * yet, unlike `highValueThresholdCents`.
 */
export function evaluateOverdueTask(
  task: Task,
  now: Date,
  criticalDaysOverdue: number = DEFAULT_CRITICAL_DAYS_OVERDUE,
): OverdueTaskSignal | null {
  if (!isValidTaskForEvaluation(task, now)) {
    return null;
  }

  if (task.completed) {
    return null;
  }

  const elapsedMilliseconds = now.getTime() - task.dueAt.getTime();

  if (elapsedMilliseconds < 0) {
    return null;
  }

  const daysOverdue = Math.floor(elapsedMilliseconds / MILLISECONDS_PER_DAY);

  return {
    id: `task.overdue:${task.organizationId}:${task.id}`,
    type: "task.overdue",
    taskId: task.id,
    organizationId: task.organizationId,
    severity: daysOverdue >= criticalDaysOverdue ? "critical" : "high",
    daysOverdue,
    explanation: `"${task.name}"${task.assigneeName ? ` (assigned to ${task.assigneeName})` : ""} is ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} past its due date and still not complete.`,
    recommendedAction: `Follow up on "${task.name}" or update its due date.`,
    evidence: [
      {
        integrationId: task.source.integrationId,
        system: task.source.system,
        externalRecordId: task.source.externalRecordId,
        sourceVersion: task.source.sourceVersion,
        recordDigestSha256: task.source.recordDigestSha256,
        lastSyncedAt: new Date(task.source.lastSyncedAt.getTime()),
      },
    ],
  };
}

function isValidLeadForEvaluation(lead: Lead, now: Date): boolean {
  return (
    isValidDate(now) &&
    isValidDate(lead.createdAt) &&
    isValidDate(lead.source.lastSyncedAt) &&
    (lead.lastInteractionAt === null || isValidDate(lead.lastInteractionAt)) &&
    Number.isFinite(lead.valueCents) &&
    Number.isInteger(lead.valueCents) &&
    lead.valueCents >= 0 &&
    Number.isFinite(lead.expectedResponseHours) &&
    Number.isInteger(lead.expectedResponseHours) &&
    lead.expectedResponseHours > 0
  );
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? hours.toString() : hours.toFixed(1);
}

/**
 * Evaluates the deterministic first-slice rule: a lead is stuck when it has no
 * recorded interaction and its response threshold has elapsed.
 *
 * Invalid temporal or numeric values, as well as clocks that place `now`
 * before lead creation, fail closed by producing no signal.
 *
 * `criticalValueCents` decides the "critical" vs. "high" severity split —
 * defaults to a fallback constant, but real callers should pass the
 * organization's own configured threshold.
 *
 * `workingDaysBitmask`/`timeZone` decide which elapsed hours actually
 * count — default to "every day counts, UTC" (today's behavior), but real
 * callers should pass the organization's own configured working days, or a
 * lead created just before a weekend/holiday will read as neglected days
 * before the business was ever actually open to respond to it.
 */
export function evaluateUntouchedLead(
  lead: Lead,
  now: Date,
  criticalValueCents: number = DEFAULT_CRITICAL_VALUE_CENTS,
  workingDaysBitmask: number = ALL_DAYS_BITMASK,
  timeZone: string = "UTC",
): StuckLeadSignal | null {
  if (!isValidLeadForEvaluation(lead, now)) {
    return null;
  }

  if (lead.lastInteractionAt !== null) {
    return null;
  }

  const elapsedMilliseconds = now.getTime() - lead.createdAt.getTime();

  if (elapsedMilliseconds < 0) {
    return null;
  }

  const elapsedHours = elapsedBusinessHours(
    lead.createdAt,
    now,
    workingDaysBitmask,
    timeZone,
  );

  if (elapsedHours < lead.expectedResponseHours) {
    return null;
  }

  const elapsedLabel = formatHours(elapsedHours);
  const thresholdLabel = formatHours(lead.expectedResponseHours);

  return {
    id: `lead.untouched:${lead.organizationId}:${lead.id}`,
    type: "lead.untouched",
    leadId: lead.id,
    organizationId: lead.organizationId,
    severity: lead.valueCents >= criticalValueCents ? "critical" : "high",
    elapsedHours,
    thresholdHours: lead.expectedResponseHours,
    businessImpactCents: lead.valueCents,
    currency: lead.currency,
    explanation: `${lead.contactName} at ${lead.companyName} has had no recorded interaction for ${elapsedLabel} hours, meeting the ${thresholdLabel}-hour response threshold.`,
    recommendedAction: `Contact ${lead.contactName} and record the next step.`,
    evidence: [
      {
        integrationId: lead.source.integrationId,
        system: lead.source.system,
        externalRecordId: lead.source.externalRecordId,
        sourceVersion: lead.source.sourceVersion,
        recordDigestSha256: lead.source.recordDigestSha256,
        lastSyncedAt: new Date(lead.source.lastSyncedAt.getTime()),
      },
    ],
  };
}
