/**
 * A first real, narrow slice of the proposed `SignalDesk Control Plane`
 * (Prompt 11, `docs/product-vision-backlog.md`, ADR 0028) — not the full
 * `PolicyRule`/`PolicyVersion`/simulation engine that proposal describes,
 * just proof that a single shared, pure, deterministic decision function
 * can serve more than one real enforcement point without either one
 * losing anything. Lives here (not `@signaldesk/application`) because
 * both real callers need it: `@signaldesk/persistence`'s
 * `canAddActiveConnection` and apps/web's `AgentGatewayService` sit on
 * different sides of the dependency graph, and `@signaldesk/domain` is
 * the one package both already depend on (transitively or directly)
 * where a zero-IO decision function can live. `ALLOW`/`DENY` only for
 * now — `REQUIRE_APPROVAL`/`REQUIRE_REAUTH`/`REQUIRE_MORE_EVIDENCE`/
 * `DEFER` stay unbuilt until a real caller needs one of them.
 */

export type PolicyDecisionOutcome = "allow" | "deny";

export interface PolicyDecision {
  readonly outcome: PolicyDecisionOutcome;
  readonly reason: string;
}

/**
 * Add a new variant here, not a new parallel function, the day a third
 * real enforcement point exists — that's the entire point of routing
 * every policy check through one evaluator.
 */
export type PolicyRequest =
  | {
      readonly kind: "agent_capability";
      readonly agentId: string;
      readonly declaredCapabilities: readonly string[];
      readonly requestedCapability: string;
    }
  | {
      readonly kind: "connector_connection_limit";
      readonly activeConnectionsUsed: number;
      readonly activeConnectionsLimit: number | null;
    };

export function evaluatePolicy(request: PolicyRequest): PolicyDecision {
  switch (request.kind) {
    case "agent_capability":
      return request.declaredCapabilities.includes(request.requestedCapability)
        ? {
            outcome: "allow",
            reason: `Agent "${request.agentId}" declares capability "${request.requestedCapability}".`,
          }
        : {
            outcome: "deny",
            reason: `Agent "${request.agentId}" does not declare capability "${request.requestedCapability}".`,
          };

    case "connector_connection_limit":
      return request.activeConnectionsLimit === null ||
        request.activeConnectionsUsed < request.activeConnectionsLimit
        ? {
            outcome: "allow",
            reason: "Active connection count is within the plan limit.",
          }
        : {
            outcome: "deny",
            reason: `Active connections (${request.activeConnectionsUsed}) already at the plan limit (${request.activeConnectionsLimit}).`,
          };
  }
}

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

/** One real, per-invoice amount a payment was applied against — the source
 * system's own invoice id (not this app's `Invoice.id`), paired with the
 * actual dollar figure attributed to that invoice, not the payment's full
 * total. A single bulk payment settling several invoices carries one
 * allocation per invoice, each with its own amount, so summing every
 * invoice's allocated amounts never exceeds the payment's real total. */
export interface PaymentInvoiceAllocation {
  readonly externalInvoiceId: string;
  readonly amountCents: number;
}

export interface Payment {
  readonly id: string;
  readonly organizationId: string;
  readonly customerName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly receivedAt: Date;
  /** Empty when the source payment carries no linked-transaction data. */
  readonly invoiceAllocations: readonly PaymentInvoiceAllocation[];
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
  /** The real, resolved owner (Prompt 29, docs/product-vision-backlog.md,
   * ADR 0039) — `null` unless `assigneeName` exactly, case-insensitively
   * matched a real member's own display name at ingest time
   * (`resolveMembershipIdByDisplayName`, `@signaldesk/persistence`).
   * Reuses `LeadOwner`'s shape rather than a parallel type — both are the
   * same "resolved to a real internal membership" concept. */
  readonly owner: LeadOwner | null;
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

/**
 * A real, ingested email message (Phase 4b, implementation roadmap) —
 * deliberately carries no message body: `listUnansweredExternalMessages`
 * (`@signaldesk/persistence`) never selects `messages.body_preview`, so
 * this type structurally cannot leak full body text into a finding, a
 * card, or an AI prompt — only `snippet` (Gmail's own short preview) is
 * ever visible this far up the stack. `leadId` is `null` unless
 * `counterpartyEmail` exactly matched a real `leads.contact_email` at
 * ingest time — honestly expected to be `null` for effectively every
 * message today, since no ingest function populates `contact_email` yet.
 */
export interface Message {
  readonly id: string;
  readonly organizationId: string;
  readonly leadId: string | null;
  readonly externalThreadId: string;
  readonly direction: "inbound" | "outbound";
  readonly counterpartyEmail: string;
  readonly counterpartyName: string | null;
  readonly subject: string;
  readonly snippet: string | null;
  readonly occurredAt: Date;
  readonly source: SourceReference;
}

export interface MessageAwaitingReplySignal {
  readonly id: string;
  readonly type: "message.awaiting_reply";
  readonly messageId: string;
  readonly organizationId: string;
  readonly severity: "high" | "critical";
  readonly elapsedHours: number;
  readonly thresholdHours: number;
  readonly explanation: string;
  readonly recommendedAction: string;
  readonly evidence: readonly SourceReference[];
}

/**
 * A real, ingested support ticket (first shipped for Zendesk). No
 * `Customer`/`Account`/`Contact` entity exists in this Business Graph yet
 * (`docs/product-vision-backlog.md`'s "Customer Operations Intelligence"
 * entry confirms this directly), so a ticket deliberately carries no
 * cross-entity link the way `Message.leadId` does — `requesterName` is
 * free text, not a resolved relationship. `owner` mirrors `Task.owner`
 * exactly: resolved at ingest time from `assigneeName` via
 * `resolveMembershipIdByDisplayName` (`@signaldesk/persistence`, ADR
 * 0039), `null` unless it exactly, case-insensitively matched a real
 * member's display name. `dueAt` is honestly nullable — real Zendesk
 * tickets only carry a due date for "task"-type tickets, a minority case;
 * `lastActivityAt` (the source's own `updated_at`) is what the risk
 * evaluator below actually keys on, not `dueAt`.
 */
export interface SupportTicket {
  readonly id: string;
  readonly organizationId: string;
  readonly subject: string;
  readonly status: "new" | "open" | "pending" | "hold" | "solved" | "closed";
  readonly priority: "urgent" | "high" | "normal" | "low" | null;
  readonly requesterName: string | null;
  readonly assigneeName: string | null;
  readonly owner: LeadOwner | null;
  readonly dueAt: Date | null;
  readonly lastActivityAt: Date;
  readonly source: SourceReference;
}

export interface TicketStuckSignal {
  readonly id: string;
  readonly type: "ticket.stuck";
  readonly ticketId: string;
  readonly organizationId: string;
  readonly severity: "high" | "critical";
  readonly elapsedHours: number;
  readonly thresholdHours: number;
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
 * `@signaldesk/persistence`) rather than relying on this. */
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

const DEFAULT_CRITICAL_MESSAGE_HOURS = 72;

/**
 * Evaluates the deterministic rule: an **inbound** message with no later
 * **outbound** reply in the same thread, past the organization's own
 * response-time threshold, is awaiting a reply. Mirrors
 * `evaluateUntouchedLead`'s working-hours-aware elapsed-time logic exactly
 * (a message that arrived just before a weekend shouldn't read as
 * neglected before the business was ever open to answer it) — the
 * evaluator itself only ever sees one candidate message at a time;
 * resolving "is this the latest, still-unanswered message in its thread"
 * is `listUnansweredExternalMessages`'s job (`@signaldesk/persistence`),
 * not this function's.
 *
 * `expectedResponseHours` is the organization's own configured response
 * threshold (`OrganizationBusinessProfile.defaultExpectedResponseHours`)
 * — there is no per-message threshold the way a lead has its own, since a
 * message carries no independently-negotiated response expectation.
 * `criticalResponseHours` (default 72) is the "critical" vs. "high"
 * severity boundary, mirroring `evaluateOverdueTask`'s
 * `criticalDaysOverdue` — a message has no dollar value to threshold
 * against the way a lead does. Like `daysOverdue`, it's measured *past*
 * the threshold (elapsed minus expected), not against total elapsed time:
 * `expectedResponseHoursValue` is org-configurable up to 720h, and an
 * absolute-elapsed-time comparison would make every finding for an org
 * with a threshold above 72h report "critical" the instant it fires,
 * collapsing the two-tier severity to one tier for that org.
 */
export function evaluateMessageAwaitingReply(
  message: Message,
  now: Date,
  expectedResponseHoursValue: number,
  criticalResponseHours: number = DEFAULT_CRITICAL_MESSAGE_HOURS,
  workingDaysBitmask: number = ALL_DAYS_BITMASK,
  timeZone: string = "UTC",
): MessageAwaitingReplySignal | null {
  if (
    !isValidDate(now) ||
    !isValidDate(message.occurredAt) ||
    !isValidDate(message.source.lastSyncedAt) ||
    !Number.isFinite(expectedResponseHoursValue) ||
    expectedResponseHoursValue <= 0
  ) {
    return null;
  }

  if (message.direction !== "inbound") {
    return null;
  }

  const elapsedMilliseconds = now.getTime() - message.occurredAt.getTime();

  if (elapsedMilliseconds < 0) {
    return null;
  }

  const elapsedHours = elapsedBusinessHours(
    message.occurredAt,
    now,
    workingDaysBitmask,
    timeZone,
  );

  if (elapsedHours < expectedResponseHoursValue) {
    return null;
  }

  const elapsedLabel = formatHours(elapsedHours);
  const counterparty = message.counterpartyName ?? message.counterpartyEmail;

  return {
    id: `message.awaiting_reply:${message.organizationId}:${message.id}`,
    type: "message.awaiting_reply",
    messageId: message.id,
    organizationId: message.organizationId,
    severity:
      elapsedHours - expectedResponseHoursValue >= criticalResponseHours
        ? "critical"
        : "high",
    elapsedHours,
    thresholdHours: expectedResponseHoursValue,
    explanation: `A message from ${counterparty}${message.subject ? ` ("${message.subject}")` : ""} has had no reply for ${elapsedLabel} hours.`,
    recommendedAction: `Reply to ${counterparty} or record why this doesn't need a response.`,
    evidence: [
      {
        integrationId: message.source.integrationId,
        system: message.source.system,
        externalRecordId: message.source.externalRecordId,
        sourceVersion: message.source.sourceVersion,
        recordDigestSha256: message.source.recordDigestSha256,
        lastSyncedAt: new Date(message.source.lastSyncedAt.getTime()),
      },
    ],
  };
}

const DEFAULT_CRITICAL_TICKET_HOURS = 72;

/**
 * Evaluates the deterministic rule: an open ticket with no activity past
 * the organization's own response-time threshold is stuck. Mirrors
 * `evaluateMessageAwaitingReply`'s shape closely (same working-hours-aware
 * `elapsedBusinessHours` helper, same threshold/critical-threshold pair,
 * same critical-hours-past-threshold severity math — see that function's
 * doc comment for why it isn't total elapsed time), with one deliberate
 * difference: it keys on `lastActivityAt` (the
 * ticket's own `updated_at`), not `dueAt` — most real Zendesk tickets
 * never carry a due date at all (see `SupportTicket`'s own doc comment),
 * so an `evaluateOverdueTask`-style due-date rule would silently never
 * fire for the common case.
 *
 * Only `new`/`open`/`pending` tickets are evaluated. `hold` is
 * deliberately excluded, not merged in with the "stuck" statuses: Zendesk
 * agents use `hold` specifically to mean "waiting on a third party
 * (engineering, the customer, a vendor)," not neglect by the support
 * team — surfacing it as "stuck" would be a false positive on a ticket
 * that's actually being tracked correctly. `solved`/`closed` are
 * obviously excluded as already-resolved.
 */
export function evaluateTicketStuck(
  ticket: SupportTicket,
  now: Date,
  expectedResponseHoursValue: number,
  criticalResponseHours: number = DEFAULT_CRITICAL_TICKET_HOURS,
  workingDaysBitmask: number = ALL_DAYS_BITMASK,
  timeZone: string = "UTC",
): TicketStuckSignal | null {
  if (
    !isValidDate(now) ||
    !isValidDate(ticket.lastActivityAt) ||
    !isValidDate(ticket.source.lastSyncedAt) ||
    !Number.isFinite(expectedResponseHoursValue) ||
    expectedResponseHoursValue <= 0
  ) {
    return null;
  }

  if (
    ticket.status !== "new" &&
    ticket.status !== "open" &&
    ticket.status !== "pending"
  ) {
    return null;
  }

  const elapsedMilliseconds = now.getTime() - ticket.lastActivityAt.getTime();

  if (elapsedMilliseconds < 0) {
    return null;
  }

  const elapsedHours = elapsedBusinessHours(
    ticket.lastActivityAt,
    now,
    workingDaysBitmask,
    timeZone,
  );

  if (elapsedHours < expectedResponseHoursValue) {
    return null;
  }

  const elapsedLabel = formatHours(elapsedHours);
  const assignee = ticket.assigneeName
    ? ` (assigned to ${ticket.assigneeName})`
    : " (unassigned)";
  // Only "new"/"open"/"pending" ever reach here (the status check above),
  // and "open" is the only one of the three starting with a vowel sound —
  // caught live in the browser (real rendered text read "A open ticket"),
  // not by the unit tests, which never asserted on this string's exact
  // wording.
  const article = ticket.status === "open" ? "An" : "A";

  return {
    id: `ticket.stuck:${ticket.organizationId}:${ticket.id}`,
    type: "ticket.stuck",
    ticketId: ticket.id,
    organizationId: ticket.organizationId,
    severity:
      elapsedHours - expectedResponseHoursValue >= criticalResponseHours
        ? "critical"
        : "high",
    elapsedHours,
    thresholdHours: expectedResponseHoursValue,
    explanation: `${article} ${ticket.status} ticket ("${ticket.subject}")${assignee} has had no activity for ${elapsedLabel} hours.`,
    recommendedAction: `Follow up on this ticket or update its status.`,
    evidence: [
      {
        integrationId: ticket.source.integrationId,
        system: ticket.source.system,
        externalRecordId: ticket.source.externalRecordId,
        sourceVersion: ticket.source.sourceVersion,
        recordDigestSha256: ticket.source.recordDigestSha256,
        lastSyncedAt: new Date(ticket.source.lastSyncedAt.getTime()),
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

/**
 * A real, deterministic entity name normalization — trim + lowercase,
 * nothing fuzzy/phonetic/probabilistic. Originally lived only in
 * `@signaldesk/data-quality` (`detectInvoiceLeadNameDuplicates`'s cross-
 * system duplicate-entity check); moved here, the one package every
 * canonical-entity-adjacent package already depends on, so
 * `@signaldesk/intelligence`'s finding-correlation logic can reuse the
 * exact same normalization rather than a second, potentially-drifting
 * copy. Deliberately exact-string only: this is used to *surface*
 * "these might describe the same real-world business" as a hint, never
 * to silently merge or discard any underlying record — matching this
 * repo's own rule against auto-merging entities on anything less certain
 * than an exact match.
 */
export function normalizeEntityName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Financial Exposure & Money Intelligence (Prompt 26,
 * docs/product-vision-backlog.md, ADR 0037) — the full classification
 * vocabulary that prompt names. Lives here, not in `@signaldesk/semantics`
 * (where it originated) or `@signaldesk/schemas`, because both of those
 * packages need it and `domain` is the one dependency-free package below
 * both — `semantics` transitively depends on `@signaldesk/integrations`
 * (real Node/OAuth/Stripe client code), so a schema-validation package
 * pulling `ExposureType` from `semantics` would drag that whole runtime
 * graph in for one string-literal union. `semantics` re-exports this type
 * from here to keep its own existing public API unchanged.
 *
 * Only `CONFIRMED_AMOUNT`, `OUTSTANDING_AMOUNT`, `AT_RISK_AMOUNT`, and
 * `POTENTIAL_EXPOSURE` are ever assigned to a real metric today (see
 * `@signaldesk/semantics`'s `catalog.ts`). `CONTRACTED_AMOUNT` and
 * `FORECAST_IMPACT` are declared for completeness but unused — no
 * connector this app syncs carries contract terms, and there is no
 * forecasting engine (matching `MetricValueKind.FORECAST_VALUE`'s own
 * "declared, never produced" precedent).
 */
export type ExposureType =
  | "CONFIRMED_AMOUNT"
  | "CONTRACTED_AMOUNT"
  | "OUTSTANDING_AMOUNT"
  | "AT_RISK_AMOUNT"
  | "POTENTIAL_EXPOSURE"
  | "FORECAST_IMPACT";

export const EXPOSURE_TYPE_LABEL: Record<ExposureType, string> = {
  CONFIRMED_AMOUNT: "Confirmed amount",
  CONTRACTED_AMOUNT: "Contracted amount",
  OUTSTANDING_AMOUNT: "Outstanding amount",
  AT_RISK_AMOUNT: "At-risk amount",
  POTENTIAL_EXPOSURE: "Potential exposure",
  FORECAST_IMPACT: "Forecast impact",
};

/**
 * Converts a date-only string with no time-of-day component (QuickBooks'
 * `DueDate`/`TxnDate`, Asana's `due_on`, Jira's `duedate` — each a real
 * `yyyy-MM-dd` field, never a full timestamp) into a real ISO instant,
 * anchored to the END of that calendar day in UTC — not JavaScript's own
 * default interpretation of a bare date string, which is UTC midnight,
 * the *start* of the day.
 *
 * This is the fix for a real, systemic bug (found by a deep audit,
 * 2026-08-22): every mapper that did `new Date(dateOnlyString)` directly
 * registered a "due" date at UTC midnight, which for any US (or other
 * UTC-negative) timezone is still the *previous* calendar day locally —
 * `evaluateOverdueInvoice`/`evaluateOverdueTask` (this file) then flagged
 * the record overdue up to a full day before its real local due date,
 * for every affected record, every time, not as an edge case.
 *
 * End-of-day UTC is the correct fix without needing the organization's
 * own timezone at the mapper layer (mappers are pure, context-free
 * transforms by design — no org context reaches them): for every
 * real-world UTC offset (UTC-12 through UTC+14), a business's true local
 * "due by end of this calendar day" moment always falls before this
 * instant, so an `elapsedMilliseconds = now - dueAt` overdue check can
 * never fire early. It can still under-report by up to a day for a
 * timezone ahead of UTC (e.g. UTC+14) — the safe direction for a
 * "what's stuck" signal to be wrong in, matching this app's own
 * discipline against fabricating false alarms.
 */
export function endOfDateOnlyDayUtc(dateOnly: string): string {
  return new Date(`${dateOnly}T23:59:59.999Z`).toISOString();
}
