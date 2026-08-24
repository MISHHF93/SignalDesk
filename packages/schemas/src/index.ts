import type {
  ExposureType,
  Invoice,
  Lead,
  Message,
  Payment,
  SupportTicket,
  Task,
} from "@signaldesk/domain";
import { z } from "zod";

const nonEmptyIdentifierSchema = z.string().trim().min(1);
const isoTimestampSchema = z.iso.datetime({ offset: true });
const sha256DigestSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const sourceLeadRecordSchema = z.strictObject({
  id: z.uuid(),
  // Bounded even though these are free text from an external system (e.g.
  // HubSpot's dealname) — a source system's own field limits are not a
  // security control this app can rely on, so it enforces its own.
  contactName: z.string().trim().min(1).max(500),
  companyName: z.string().trim().min(1).max(500),
  valueCents: z.number().int().nonnegative().finite(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  // External systems' owner/user ids are essentially never UUIDs (HubSpot
  // uses small integers, Salesforce uses its own 15/18-char ids, etc.) —
  // this is raw source data, not an internal membership id, so it must not
  // be UUID-constrained (same fix already applied to ownerReferenceSchema).
  owner: z
    .strictObject({
      id: nonEmptyIdentifierSchema,
      name: z.string().trim().min(1),
    })
    .nullable(),
  stage: z.string().trim().min(1).max(200),
  createdAt: isoTimestampSchema,
  lastInteractionAt: isoTimestampSchema.nullable(),
  expectedResponseHours: z.number().int().positive().finite(),
  source: z.strictObject({
    system: z.string().trim().min(1),
    externalRecordId: nonEmptyIdentifierSchema,
    sourceVersion: z.string().trim().min(1),
    recordDigestSha256: sha256DigestSchema,
    lastSyncedAt: isoTimestampSchema,
  }),
});

export type SourceLeadRecord = z.infer<typeof sourceLeadRecordSchema>;

export interface SourceLeadRecordContext {
  readonly organizationId: string;
  readonly integrationId: string;
}

const sourceLeadRecordContextSchema = z.strictObject({
  organizationId: z.uuid(),
  integrationId: z.uuid(),
});

function mapSourceLeadRecord(
  record: SourceLeadRecord,
  organizationId: string,
  integrationId: string,
): Lead {
  return {
    id: record.id,
    organizationId,
    contactName: record.contactName,
    companyName: record.companyName,
    valueCents: record.valueCents,
    currency: record.currency,
    owner: record.owner,
    stage: record.stage,
    createdAt: new Date(record.createdAt),
    lastInteractionAt:
      record.lastInteractionAt === null
        ? null
        : new Date(record.lastInteractionAt),
    expectedResponseHours: record.expectedResponseHours,
    source: {
      integrationId,
      system: record.source.system,
      externalRecordId: record.source.externalRecordId,
      sourceVersion: record.source.sourceVersion,
      recordDigestSha256: record.source.recordDigestSha256,
      lastSyncedAt: new Date(record.source.lastSyncedAt),
    },
  };
}

export function parseSourceLeadRecord(
  input: unknown,
  context: SourceLeadRecordContext | undefined,
): Lead {
  const record = sourceLeadRecordSchema.parse(input);
  const trustedContext = sourceLeadRecordContextSchema.parse(context);

  return mapSourceLeadRecord(
    record,
    trustedContext.organizationId,
    trustedContext.integrationId,
  );
}

export const sourceInvoiceRecordSchema = z.strictObject({
  id: z.uuid(),
  // Bounded even though this is free text from an external system, for the
  // same reason sourceLeadRecordSchema bounds contactName/companyName — a
  // source system's own field limits are not a security control this app
  // can rely on. 41 (not QuickBooks' 21-character DocNumber limit) because
  // this is the *customer* name (CustomerRef.name), not the invoice's own
  // document number.
  customerName: z.string().trim().min(1).max(500),
  amountCents: z.number().int().nonnegative().finite(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  dueAt: isoTimestampSchema,
  status: z.enum(["open", "paid", "void"]),
  source: z.strictObject({
    system: z.string().trim().min(1),
    externalRecordId: nonEmptyIdentifierSchema,
    sourceVersion: z.string().trim().min(1),
    recordDigestSha256: sha256DigestSchema,
    lastSyncedAt: isoTimestampSchema,
  }),
});

export type SourceInvoiceRecord = z.infer<typeof sourceInvoiceRecordSchema>;

export interface SourceInvoiceRecordContext {
  readonly organizationId: string;
  readonly integrationId: string;
}

const sourceInvoiceRecordContextSchema = z.strictObject({
  organizationId: z.uuid(),
  integrationId: z.uuid(),
});

function mapSourceInvoiceRecord(
  record: SourceInvoiceRecord,
  organizationId: string,
  integrationId: string,
): Invoice {
  return {
    id: record.id,
    organizationId,
    customerName: record.customerName,
    amountCents: record.amountCents,
    currency: record.currency,
    dueAt: new Date(record.dueAt),
    status: record.status,
    source: {
      integrationId,
      system: record.source.system,
      externalRecordId: record.source.externalRecordId,
      sourceVersion: record.source.sourceVersion,
      recordDigestSha256: record.source.recordDigestSha256,
      lastSyncedAt: new Date(record.source.lastSyncedAt),
    },
  };
}

export function parseSourceInvoiceRecord(
  input: unknown,
  context: SourceInvoiceRecordContext | undefined,
): Invoice {
  const record = sourceInvoiceRecordSchema.parse(input);
  const trustedContext = sourceInvoiceRecordContextSchema.parse(context);

  return mapSourceInvoiceRecord(
    record,
    trustedContext.organizationId,
    trustedContext.integrationId,
  );
}

export const paymentInvoiceAllocationSchema = z.strictObject({
  externalInvoiceId: nonEmptyIdentifierSchema,
  amountCents: z.number().int().nonnegative().finite(),
});

export type PaymentInvoiceAllocation = z.infer<
  typeof paymentInvoiceAllocationSchema
>;

export const sourcePaymentRecordSchema = z.strictObject({
  id: z.uuid(),
  customerName: z.string().trim().min(1).max(500),
  amountCents: z.number().int().nonnegative().finite(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  receivedAt: isoTimestampSchema,
  invoiceAllocations: z.array(paymentInvoiceAllocationSchema).max(50),
  source: z.strictObject({
    system: z.string().trim().min(1),
    externalRecordId: nonEmptyIdentifierSchema,
    sourceVersion: z.string().trim().min(1),
    recordDigestSha256: sha256DigestSchema,
    lastSyncedAt: isoTimestampSchema,
  }),
});

export type SourcePaymentRecord = z.infer<typeof sourcePaymentRecordSchema>;

export interface SourcePaymentRecordContext {
  readonly organizationId: string;
  readonly integrationId: string;
}

const sourcePaymentRecordContextSchema = z.strictObject({
  organizationId: z.uuid(),
  integrationId: z.uuid(),
});

function mapSourcePaymentRecord(
  record: SourcePaymentRecord,
  organizationId: string,
  integrationId: string,
): Payment {
  return {
    id: record.id,
    organizationId,
    customerName: record.customerName,
    amountCents: record.amountCents,
    currency: record.currency,
    receivedAt: new Date(record.receivedAt),
    invoiceAllocations: record.invoiceAllocations,
    source: {
      integrationId,
      system: record.source.system,
      externalRecordId: record.source.externalRecordId,
      sourceVersion: record.source.sourceVersion,
      recordDigestSha256: record.source.recordDigestSha256,
      lastSyncedAt: new Date(record.source.lastSyncedAt),
    },
  };
}

export function parseSourcePaymentRecord(
  input: unknown,
  context: SourcePaymentRecordContext | undefined,
): Payment {
  const record = sourcePaymentRecordSchema.parse(input);
  const trustedContext = sourcePaymentRecordContextSchema.parse(context);

  return mapSourcePaymentRecord(
    record,
    trustedContext.organizationId,
    trustedContext.integrationId,
  );
}

export const sourceTaskRecordSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(500),
  assigneeName: z.string().trim().min(1).max(200).nullable(),
  dueAt: isoTimestampSchema,
  completed: z.boolean(),
  source: z.strictObject({
    system: z.string().trim().min(1),
    externalRecordId: nonEmptyIdentifierSchema,
    sourceVersion: z.string().trim().min(1),
    recordDigestSha256: sha256DigestSchema,
    lastSyncedAt: isoTimestampSchema,
  }),
});

export type SourceTaskRecord = z.infer<typeof sourceTaskRecordSchema>;

export interface SourceTaskRecordContext {
  readonly organizationId: string;
  readonly integrationId: string;
}

const sourceTaskRecordContextSchema = z.strictObject({
  organizationId: z.uuid(),
  integrationId: z.uuid(),
});

function mapSourceTaskRecord(
  record: SourceTaskRecord,
  organizationId: string,
  integrationId: string,
): Task {
  return {
    id: record.id,
    organizationId,
    name: record.name,
    assigneeName: record.assigneeName,
    // Resolved later, at real ingest time, from a real membership lookup
    // (`resolveMembershipIdByDisplayName`, `@signaldesk/persistence`,
    // ADR 0039) — this parse step has no database access to resolve it
    // against, so it stays honestly unset here.
    owner: null,
    dueAt: new Date(record.dueAt),
    completed: record.completed,
    source: {
      integrationId,
      system: record.source.system,
      externalRecordId: record.source.externalRecordId,
      sourceVersion: record.source.sourceVersion,
      recordDigestSha256: record.source.recordDigestSha256,
      lastSyncedAt: new Date(record.source.lastSyncedAt),
    },
  };
}

export function parseSourceTaskRecord(
  input: unknown,
  context: SourceTaskRecordContext | undefined,
): Task {
  const record = sourceTaskRecordSchema.parse(input);
  const trustedContext = sourceTaskRecordContextSchema.parse(context);

  return mapSourceTaskRecord(
    record,
    trustedContext.organizationId,
    trustedContext.integrationId,
  );
}

// Bounded the same way sourceLeadRecordSchema bounds contactName/
// companyName — a source system's own field limits are not a security
// control this app can rely on. leadId is never part of the parsed
// record itself: it's resolved separately, inside the real ingest
// function, against a real `leads.contact_email` row the mapper has no
// database access to check (same division of labor sourceTaskRecordSchema
// already uses for `owner`).
export const sourceMessageRecordSchema = z.strictObject({
  id: z.uuid(),
  externalThreadId: nonEmptyIdentifierSchema,
  direction: z.enum(["inbound", "outbound"]),
  counterpartyEmail: z.string().trim().toLowerCase().min(1).max(320),
  counterpartyName: z.string().trim().min(1).max(500).nullable(),
  subject: z.string().trim().min(1).max(500),
  // Gmail's own short preview text — the only message-derived free text
  // ever exposed to a card or an AI prompt (Phase 4b, implementation
  // roadmap); bounded well below the 5,000-char body_preview cap this
  // schema deliberately never validates, since nothing above the
  // persistence layer ever reads body_preview.
  snippet: z.string().trim().max(500).nullable(),
  occurredAt: isoTimestampSchema,
  source: z.strictObject({
    system: z.string().trim().min(1),
    externalRecordId: nonEmptyIdentifierSchema,
    sourceVersion: z.string().trim().min(1),
    recordDigestSha256: sha256DigestSchema,
    lastSyncedAt: isoTimestampSchema,
  }),
});

export type SourceMessageRecord = z.infer<typeof sourceMessageRecordSchema>;

export interface SourceMessageRecordContext {
  readonly organizationId: string;
  readonly integrationId: string;
  /** Resolved separately by the real ingest function
   * (`ingestGmailMessage`, `@signaldesk/persistence`) via
   * `leads.contact_email` — `null` for effectively every message today,
   * honestly, since no ingest function populates that column yet. */
  readonly leadId: string | null;
}

const sourceMessageRecordContextSchema = z.strictObject({
  organizationId: z.uuid(),
  integrationId: z.uuid(),
  leadId: z.uuid().nullable(),
});

function mapSourceMessageRecord(
  record: SourceMessageRecord,
  organizationId: string,
  integrationId: string,
  leadId: string | null,
): Message {
  return {
    id: record.id,
    organizationId,
    leadId,
    externalThreadId: record.externalThreadId,
    direction: record.direction,
    counterpartyEmail: record.counterpartyEmail,
    counterpartyName: record.counterpartyName,
    subject: record.subject,
    snippet: record.snippet,
    occurredAt: new Date(record.occurredAt),
    source: {
      integrationId,
      system: record.source.system,
      externalRecordId: record.source.externalRecordId,
      sourceVersion: record.source.sourceVersion,
      recordDigestSha256: record.source.recordDigestSha256,
      lastSyncedAt: new Date(record.source.lastSyncedAt),
    },
  };
}

export function parseSourceMessageRecord(
  input: unknown,
  context: SourceMessageRecordContext | undefined,
): Message {
  const record = sourceMessageRecordSchema.parse(input);
  const trustedContext = sourceMessageRecordContextSchema.parse(context);

  return mapSourceMessageRecord(
    record,
    trustedContext.organizationId,
    trustedContext.integrationId,
    trustedContext.leadId,
  );
}

// Bounded the same way sourceTaskRecordSchema/sourceMessageRecordSchema
// bound their own free-text fields — a source system's own field limits
// are not a security control this app can rely on. `ownerMembershipId` is
// never part of the parsed record itself, the same division of labor
// sourceTaskRecordSchema already uses for `owner`: resolved separately,
// inside the real ingest function, from `assigneeName`.
export const sourceSupportTicketRecordSchema = z.strictObject({
  id: z.uuid(),
  subject: z.string().trim().min(1).max(500),
  status: z.enum(["new", "open", "pending", "hold", "solved", "closed"]),
  priority: z.enum(["urgent", "high", "normal", "low"]).nullable(),
  requesterName: z.string().trim().min(1).max(500).nullable(),
  assigneeName: z.string().trim().min(1).max(500).nullable(),
  dueAt: isoTimestampSchema.nullable(),
  lastActivityAt: isoTimestampSchema,
  source: z.strictObject({
    system: z.string().trim().min(1),
    externalRecordId: nonEmptyIdentifierSchema,
    sourceVersion: z.string().trim().min(1),
    recordDigestSha256: sha256DigestSchema,
    lastSyncedAt: isoTimestampSchema,
  }),
});

export type SourceSupportTicketRecord = z.infer<
  typeof sourceSupportTicketRecordSchema
>;

export interface SourceSupportTicketRecordContext {
  readonly organizationId: string;
  readonly integrationId: string;
}

const sourceSupportTicketRecordContextSchema = z.strictObject({
  organizationId: z.uuid(),
  integrationId: z.uuid(),
});

function mapSourceSupportTicketRecord(
  record: SourceSupportTicketRecord,
  organizationId: string,
  integrationId: string,
): SupportTicket {
  return {
    id: record.id,
    organizationId,
    subject: record.subject,
    status: record.status,
    priority: record.priority,
    requesterName: record.requesterName,
    assigneeName: record.assigneeName,
    // Resolved later, at real ingest time, from a real membership lookup
    // (`resolveMembershipIdByDisplayName`, `@signaldesk/persistence`,
    // ADR 0039) — this parse step has no database access to resolve it
    // against, so it stays honestly unset here.
    owner: null,
    dueAt: record.dueAt === null ? null : new Date(record.dueAt),
    lastActivityAt: new Date(record.lastActivityAt),
    source: {
      integrationId,
      system: record.source.system,
      externalRecordId: record.source.externalRecordId,
      sourceVersion: record.source.sourceVersion,
      recordDigestSha256: record.source.recordDigestSha256,
      lastSyncedAt: new Date(record.source.lastSyncedAt),
    },
  };
}

export function parseSourceSupportTicketRecord(
  input: unknown,
  context: SourceSupportTicketRecordContext | undefined,
): SupportTicket {
  const record = sourceSupportTicketRecordSchema.parse(input);
  const trustedContext = sourceSupportTicketRecordContextSchema.parse(context);

  return mapSourceSupportTicketRecord(
    record,
    trustedContext.organizationId,
    trustedContext.integrationId,
  );
}

// --- Intelligence cards -----------------------------------------------
//
// Typed contracts for the Card Registry / Generative UI boundary: the AI
// orchestration layer (deterministic today, model-backed later) controls
// which registered card type is shown and with what data, never arbitrary
// markup. An unrecognized `type`/`actionType` fails validation here rather
// than silently rendering something unregistered.

export const sourceReferenceSchema = z.strictObject({
  integrationId: z.uuid(),
  system: z.string().trim().min(1),
  externalRecordId: nonEmptyIdentifierSchema,
  sourceVersion: z.string().trim().min(1),
  recordDigestSha256: sha256DigestSchema,
  lastSyncedAt: z.date(),
});

export type SourceReferenceInput = z.infer<typeof sourceReferenceSchema>;

export const cardTypeSchema = z.enum([
  "lead_risk",
  "integration_health",
  "ownership_gap",
  "invoice_risk",
  "task_risk",
  "agent_recommendation",
  "payment_received",
  "goal_variance",
  "message_follow_up",
  "ticket_risk",
]);

export type CardType = z.infer<typeof cardTypeSchema>;

export const cardSeveritySchema = z.enum([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);

export type CardSeverity = z.infer<typeof cardSeveritySchema>;

export const cardExplanationSchema = z.strictObject({
  trigger: z.string().trim().min(1),
  observedValue: z.string().trim().min(1).optional(),
  expectedBaseline: z.string().trim().min(1).optional(),
  confidence: z.enum(["low", "medium", "high"]),
});

export type CardExplanation = z.infer<typeof cardExplanationSchema>;

export const dataFreshnessSchema = z.strictObject({
  asOf: z.date(),
  status: z.enum(["fresh", "aging", "stale", "unknown"]),
});

export type DataFreshness = z.infer<typeof dataFreshnessSchema>;

export const ownerReferenceSchema = z.strictObject({
  id: nonEmptyIdentifierSchema,
  name: z.string().trim().min(1),
});

export type OwnerReference = z.infer<typeof ownerReferenceSchema>;

// Mirrors @signaldesk/semantics's real ExposureType union — the `satisfies`
// guard fails to compile if this list stops matching that vocabulary.
const EXPOSURE_TYPE_VALUES = [
  "CONFIRMED_AMOUNT",
  "CONTRACTED_AMOUNT",
  "OUTSTANDING_AMOUNT",
  "AT_RISK_AMOUNT",
  "POTENTIAL_EXPOSURE",
  "FORECAST_IMPACT",
] as const satisfies readonly ExposureType[];

export const exposureTypeSchema = z.enum(EXPOSURE_TYPE_VALUES);

export const financialContextSchema = z.strictObject({
  label: z.enum([
    "Pipeline value",
    "Potential exposure",
    "Estimated margin impact",
    "Overdue receivable",
    "Confirmed revenue",
    "Forecast revenue",
    "Goal variance",
  ]),
  // What kind of financial claim this number is (ADR 0037 / semantics'
  // ExposureType) — required, not derived from `label`, so a future
  // capability can't mislabel a speculative number as "confirmed" by
  // omission. See packages/semantics/src/exposure.ts for the real
  // definitions.
  exposureType: exposureTypeSchema,
  amountCents: z.number().int().nonnegative().finite(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export type FinancialContext = z.infer<typeof financialContextSchema>;

export const actionProposalSchema = z
  .strictObject({
    id: nonEmptyIdentifierSchema,
    actionType: z.enum(["create_internal_task"]),
    // "agent_assisted_internal" is strictly riskier than "low_risk_internal":
    // it's a deterministic capability's proposal vs. one an agent authored
    // from model-interpreted findings, which is exactly why the latter
    // always pairs with requiresApproval: true, enforced below.
    riskClass: z.enum(["low_risk_internal", "agent_assisted_internal"]),
    label: z.string().trim().min(1),
    requiresApproval: z.boolean(),
    // Present only for an agent-authored proposal (see
    // @signaldesk/application's agent-result-reconciler.ts); absent for
    // every deterministic capability's own proposal, so
    // buildActionProposals' existing output is unchanged.
    proposedByAgentId: nonEmptyIdentifierSchema.optional(),
  })
  // Keeps the pairing an invariant rather than two independently-settable
  // fields: a deterministic capability's proposal can never require
  // approval, and an agent-authored one always must — no caller can
  // construct the nonsensical opposite of either.
  .refine(
    (proposal) =>
      proposal.riskClass === "low_risk_internal"
        ? proposal.requiresApproval === false
        : proposal.requiresApproval === true,
    {
      message:
        "requiresApproval must be false for low_risk_internal and true for agent_assisted_internal.",
    },
  );

export type ActionProposal = z.infer<typeof actionProposalSchema>;

export const entityReferenceSchema = z.strictObject({
  kind: z.enum([
    "lead",
    "connector",
    "invoice",
    "task",
    "payment",
    "goal",
    "message",
    "support_ticket",
  ]),
  id: z.string().trim().min(1),
});

export type EntityReference = z.infer<typeof entityReferenceSchema>;

export const intelligenceCardSchema = z.strictObject({
  id: nonEmptyIdentifierSchema,
  type: cardTypeSchema,
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  priority: z.number().int().min(0),
  severity: cardSeveritySchema,
  entity: entityReferenceSchema.optional(),
  owner: ownerReferenceSchema.optional(),
  explanation: cardExplanationSchema,
  sources: z.array(sourceReferenceSchema),
  financialContext: financialContextSchema.optional(),
  recommendedActions: z.array(actionProposalSchema),
  freshness: dataFreshnessSchema,
  /** Other card ids that share this card's real, normalized customer
   * name (`correlateFindingsByName`, `@signaldesk/intelligence`) — a
   * presentation hint that these may describe the same real-world
   * situation, never a merge; every id here still resolves to its own
   * fully independent card. Absent (not an empty array) when this card
   * has no real correlation name or matched nothing else. */
  relatedFindingIds: z.array(nonEmptyIdentifierSchema).optional(),
});

export type IntelligenceCard = z.infer<typeof intelligenceCardSchema>;

// --- Agent Fabric ----------------------------------------------------------
//
// Governed multi-agent collaboration: a coordinator (see
// @signaldesk/application's parallel-specialist-coordinator.ts) delegates
// bounded, structured tasks to specialist agents, never free-form prose.
// Reuses sourceReferenceSchema/entityReferenceSchema above rather than
// inventing a parallel evidence shape — an agent's "evidence" is the same
// SourceReference an IntelligenceFinding already carries.
//
// Only two capabilities exist because only two real specialists exist today
// (see AGENT_REGISTRY, @signaldesk/application) — widen this enum only when
// a third real specialist is added, not speculatively.

export const agentCapabilitySchema = z.enum([
  "interpret_financial_risk",
  "interpret_delivery_risk",
]);

export type AgentCapability = z.infer<typeof agentCapabilitySchema>;

export const agentCardSchema = z.strictObject({
  id: nonEmptyIdentifierSchema,
  provider: z.enum(["deterministic", "anthropic"]),
  displayName: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(500),
  capabilities: z.array(agentCapabilitySchema).min(1),
  dataAccess: z.array(z.enum(["invoice_findings", "task_findings"])).min(1),
  riskLevel: z.enum(["low", "moderate"]),
  canRead: z.literal(true),
  canPropose: z.boolean(),
  // Hard invariant, not per-agent config: no agent in this system may ever
  // execute a business mutation directly. Widening this to z.boolean() is
  // deliberately out of scope until a second real reason exists — see
  // docs/adr/0020-agent-fabric.md.
  canExecute: z.literal(false),
  requiresApproval: z.literal(true),
  costPerTaskUsdMicros: z.number().int().nonnegative(),
  timeBudgetMs: z.number().int().positive(),
});

export type AgentCard = z.infer<typeof agentCardSchema>;

export const agentTaskSchema = z.strictObject({
  id: nonEmptyIdentifierSchema,
  objective: z.string().trim().min(1).max(500),
  requestedCapability: agentCapabilitySchema,
  // The source evidence grounding this task, for prompt context — NOT the
  // source of AgentTaskResult.evidenceIds below (those are real finding
  // ids, set by the trusted gateway from the findings it dispatched, never
  // echoed back from a provider).
  contextRefs: z.array(sourceReferenceSchema).min(1),
  constraints: z.strictObject({
    maxFindings: z.number().int().positive().max(50),
    mustNotInventFacts: z.literal(true),
  }),
});

export type AgentTask = z.infer<typeof agentTaskSchema>;

export const agentTaskResultSchema = z.strictObject({
  taskId: nonEmptyIdentifierSchema,
  agentId: nonEmptyIdentifierSchema,
  status: z.enum(["completed", "abstained", "failed"]),
  claims: z.array(z.string().trim().min(1)).max(10),
  // Must be a subset of the finding ids the task actually handed the agent —
  // agent-result-reconciler.ts rejects a result that cites evidence it was
  // never given, rather than trusting an agent's self-reported citations.
  evidenceIds: z.array(nonEmptyIdentifierSchema),
  recommendation: z.string().trim().min(1).max(500).optional(),
  limitations: z.array(z.string().trim().min(1)).max(5).optional(),
  confidence: z.number().min(0).max(1),
});

export type AgentTaskResult = z.infer<typeof agentTaskResultSchema>;

export const agentCapabilityGrantSchema = z.strictObject({
  id: nonEmptyIdentifierSchema,
  collaborationId: nonEmptyIdentifierSchema,
  agentId: nonEmptyIdentifierSchema,
  capability: agentCapabilitySchema,
  canRead: z.literal(true),
  canPropose: z.boolean(),
  canExecute: z.literal(false),
  expiresAt: z.date(),
});

export type AgentCapabilityGrant = z.infer<typeof agentCapabilityGrantSchema>;

/**
 * What a provider's `generateStructured({task: "interpret_findings", ...})`
 * call must return — deliberately narrower than agentTaskResultSchema
 * above: a provider (deterministic or Claude) only ever produces the
 * model-derivable part of a result. The caller (ParallelSpecialistCoordinator,
 * @signaldesk/application) fills in taskId/agentId/status/evidenceIds itself
 * from what it already knows, the same "AIProvider validates its own output
 * shape, callers assemble the full typed result" split parseDashboardIntent
 * already established for parse_dashboard_command.
 */
export const specialistInterpretationSchema = z.strictObject({
  claims: z.array(z.string().trim().min(1)).max(10),
  recommendation: z.string().trim().min(1).max(500).optional(),
  limitations: z.array(z.string().trim().min(1)).max(5).optional(),
  confidence: z.number().min(0).max(1),
});

export type SpecialistInterpretation = z.infer<
  typeof specialistInterpretationSchema
>;

export function parseSpecialistInterpretation(
  input: unknown,
): SpecialistInterpretation {
  return specialistInterpretationSchema.parse(input);
}

// --- Artifacts -----------------------------------------------------------
//
// A real, deterministically-assembled work product built from the
// Intelligence Core's own findings — not a raw dashboard view, and not
// fabricated AI prose (this app has no model provider yet; see
// `@signaldesk/application`'s `deterministic-provider.ts`).
// `generatedBy` is honestly `"deterministic-assembly"` for every artifact
// today. Only `daily_brief` exists; the broader artifact taxonomy (Client
// Brief, Project Brief, Proposal, Risk Report, ...) is architected for via
// this same shape but deliberately not built until a real one is needed —
// adding a type means widening `artifactTypeSchema`, not a new contract.
//
// The status lifecycle is the full one a real review/approval workflow
// will eventually need (`draft` through `archived`) even though nothing
// in this app produces anything but `generated` yet — the same
// "anticipate honestly, only implement what's real" precedent as
// `Invoice.status`/`SourceInvoiceRecord.status` including `paid`/`void`
// before any code could ever observe that transition.

export const artifactTypeSchema = z.enum(["daily_brief"]);

export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export const artifactStatusSchema = z.enum([
  "draft",
  "generated",
  "reviewed",
  "approved",
  "published",
  "superseded",
  "archived",
]);

export type ArtifactStatus = z.infer<typeof artifactStatusSchema>;

export const artifactSchema = z.strictObject({
  id: z.uuid(),
  organizationId: z.uuid(),
  type: artifactTypeSchema,
  title: z.string().trim().min(1).max(200),
  status: artifactStatusSchema,
  generatedBy: z.literal("deterministic-assembly"),
  content: z.string().trim().min(1),
  structuredData: z.record(z.string(), z.unknown()),
  sourceFindingIds: z.array(z.string().trim().min(1)),
  generatedAt: z.date(),
});

export type Artifact = z.infer<typeof artifactSchema>;

// --- Dashboard intents ---------------------------------------------------
//
// Natural-language command-bar input is never executed directly: it is
// parsed into one of these validated, typed intents first (see
// `@signaldesk/application`'s `parseCommand`). `group` and `compare`
// are declared for contract completeness but no parser produces them yet.

const filterDefinitionSchema = z
  .strictObject({
    field: z.enum(["financialAmount", "severity", "owner", "text"]),
    operator: z.enum(["gte", "eq", "contains"]),
    value: z.union([z.number(), z.string().trim().min(1)]),
  })
  // `contains` (a free-text substring search — Prompt 31,
  // docs/product-vision-backlog.md, ADR 0040) only ever pairs with
  // `field: "text"`, and vice versa — the same "keep the pairing an
  // invariant" choice `actionProposalSchema`'s own
  // riskClass/requiresApproval refinement already makes.
  .refine(
    (filter) =>
      filter.field === "text"
        ? filter.operator === "contains"
        : filter.operator !== "contains",
    {
      message: '"contains" is only valid for field "text", and vice versa.',
    },
  );

export type FilterDefinition = z.infer<typeof filterDefinitionSchema>;

export const dashboardIntentSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("filter"),
    filters: z.array(filterDefinitionSchema).min(1),
  }),
  z.strictObject({
    type: z.literal("group"),
    field: z.enum(["owner", "severity", "type"]),
  }),
  z.strictObject({
    type: z.literal("investigate"),
    entityId: nonEmptyIdentifierSchema,
  }),
  z.strictObject({
    type: z.literal("compare"),
    periodA: z.strictObject({ from: z.date(), to: z.date() }),
    periodB: z.strictObject({ from: z.date(), to: z.date() }),
  }),
  z.strictObject({
    type: z.literal("propose_action"),
    actionType: z.enum(["create_internal_task"]),
    targets: z.array(nonEmptyIdentifierSchema).min(1),
  }),
  // Business-wide, unlike "investigate" above (which focuses one already-
  // rendered card) — triggers the Agent Fabric's one real collaboration
  // pattern (see @signaldesk/application's parallel-specialist-coordinator.ts).
  // Deliberately no fields: what to investigate is always "today's real
  // findings," re-derived server-side, never client-supplied.
  z.strictObject({
    type: z.literal("agent_investigate"),
  }),
]);

export type DashboardIntent = z.infer<typeof dashboardIntentSchema>;

export function parseDashboardIntent(input: unknown): DashboardIntent {
  return dashboardIntentSchema.parse(input);
}

export const createInternalTaskInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2_000).optional(),
  sourceCardId: nonEmptyIdentifierSchema.optional(),
  /**
   * Must be stable across a retry of the same logical request — derived
   * from what's being acted on (e.g. a card and action id), never
   * generated fresh per call. See `createInternalTask`'s doc comment in
   * `@signaldesk/persistence` for why.
   */
  idempotencyKey: nonEmptyIdentifierSchema,
});

export type CreateInternalTaskInput = z.infer<
  typeof createInternalTaskInputSchema
>;

export function parseCreateInternalTaskInput(
  input: unknown,
): CreateInternalTaskInput {
  return createInternalTaskInputSchema.parse(input);
}

export const completeInternalTaskInputSchema = z.strictObject({
  taskId: z.uuid(),
});

export type CompleteInternalTaskInput = z.infer<
  typeof completeInternalTaskInputSchema
>;

export function parseCompleteInternalTaskInput(
  input: unknown,
): CompleteInternalTaskInput {
  return completeInternalTaskInputSchema.parse(input);
}

// Goal Intelligence (Prompt 22, docs/product-vision-backlog.md, ADR 0035).
// Redeclared here rather than imported from @signaldesk/semantics' own
// METRIC_CATALOG — this package has no dependency on that one (the same
// intentional duplication `updateBusinessProfileInputSchema.industry`
// already accepts below, for the same reason: schemas stays a light,
// low-level package other packages depend on, not the other way around).
// Keep this exact list in sync with `packages/semantics/src/catalog.ts`
// and the `goals_metric_id_allowed` check constraint (migration 0041).
export const goalMetricIdSchema = z.enum([
  "accounts_receivable",
  "overdue_receivable_exposure",
  "pipeline_value",
  "cash_collected_recent",
  "open_task_backlog",
]);

export const createGoalInputSchema = z.strictObject({
  metricId: goalMetricIdSchema,
  name: z.string().trim().min(1).max(200),
  comparisonOperator: z.enum(["at_most", "at_least"]),
  targetValue: z.number().int().nonnegative().finite(),
  // Required for a currency metric, must be absent for a count metric —
  // enforced by `createGoalAction`, not here: this schema alone can't know
  // which of the five metric ids is which unit without importing the
  // catalog it deliberately doesn't depend on.
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  idempotencyKey: nonEmptyIdentifierSchema,
});

export type CreateGoalInput = z.infer<typeof createGoalInputSchema>;

export function parseCreateGoalInput(input: unknown): CreateGoalInput {
  return createGoalInputSchema.parse(input);
}

// Deliberately NOT `Intl.supportedValuesOf("timeZone").includes(value)`:
// that enumeration is documented (ECMA-402) as excluding legacy/special
// zone names — "UTC" itself is a real, always-valid `timeZone` value that
// does not appear in it in every ICU build (confirmed empirically: absent
// from this very environment's list, despite `organizations.timezone`
// defaulting to exactly `'UTC'` in the database — every organization on
// the default would otherwise be unable to save any business-profile
// change at all, since the form always resubmits its own current value).
// Constructing a real `Intl.DateTimeFormat` is the spec-accurate way to
// validate an arbitrary timeZone string: it throws for a genuinely invalid
// one and succeeds for anything the runtime can actually use, including
// "UTC".
function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const updateBusinessProfileInputSchema = z.strictObject({
  timezone: z
    .string()
    .trim()
    .refine(isValidTimeZone, {
      message: "Must be a real IANA time zone (e.g. America/Toronto).",
    })
    .optional(),
  defaultExpectedResponseHours: z.number().int().positive().max(720).optional(),
  highValueThresholdCents: z.number().int().nonnegative().optional(),
  // Bit n (0 = Sunday, matching JS Date.getUTCDay()) set means day n is a
  // working day — 0-127 covers every combination of the 7 bits.
  workingDaysBitmask: z.number().int().min(0).max(127).optional(),
  // Redeclared here rather than imported from @signaldesk/integrations'
  // `organizationIndustries` (this package has no dependency on that one) —
  // same intentional duplication as `isValidTimeZone`'s sibling constants
  // elsewhere in this file. Keep in sync with 0033/ADR 0019.
  industry: z.enum(["unspecified", "professional_services"]).optional(),
});

export type UpdateBusinessProfileInput = z.infer<
  typeof updateBusinessProfileInputSchema
>;

export function parseUpdateBusinessProfileInput(
  input: unknown,
): UpdateBusinessProfileInput {
  return updateBusinessProfileInputSchema.parse(input);
}

// Unlike the business profile, the Preferences form's three checkboxes are
// always rendered and always submitted (checked or not translates directly
// to a real boolean in the Server Action before this ever runs), so every
// field here is required — there's no "field absent, don't touch it" case
// to support.
export const updatePreferencesInputSchema = z.strictObject({
  morningBriefEnabled: z.boolean(),
  attentionAlertsEnabled: z.boolean(),
  weeklyRecapEnabled: z.boolean(),
});

export type UpdatePreferencesInput = z.infer<
  typeof updatePreferencesInputSchema
>;

export function parseUpdatePreferencesInput(
  input: unknown,
): UpdatePreferencesInput {
  return updatePreferencesInputSchema.parse(input);
}

/**
 * `ZodError.message` is a pretty-printed JSON array of issues, not a
 * sentence — never fit to show a user directly. Each issue's own
 * `.message` (e.g. "Must be a real IANA time zone...") already is a real
 * sentence, so callers (Server Actions catching a `parse*` throw) should
 * use this instead of `error.message` when building a user-facing error.
 * Returns `null` for anything that isn't a validation error, so callers
 * can fall back to their own generic message.
 */
export function describeValidationError(error: unknown): string | null {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }

  return null;
}
