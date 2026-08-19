import type { Invoice, Lead, Task } from "@signaldesk/domain";
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
  "stuck",
  "lead_risk",
  "integration_health",
  "invoice_risk",
  "task_risk",
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

export const financialContextSchema = z.strictObject({
  label: z.enum([
    "Pipeline value",
    "Potential exposure",
    "Estimated margin impact",
    "Overdue receivable",
    "Confirmed revenue",
    "Forecast revenue",
  ]),
  amountCents: z.number().int().nonnegative().finite(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export type FinancialContext = z.infer<typeof financialContextSchema>;

export const actionProposalSchema = z.strictObject({
  id: nonEmptyIdentifierSchema,
  actionType: z.enum(["create_internal_task"]),
  riskClass: z.literal("low_risk_internal"),
  label: z.string().trim().min(1),
  requiresApproval: z.literal(false),
});

export type ActionProposal = z.infer<typeof actionProposalSchema>;

export const entityReferenceSchema = z.strictObject({
  kind: z.enum(["lead", "connector", "invoice", "task"]),
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
});

export type IntelligenceCard = z.infer<typeof intelligenceCardSchema>;

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

const filterDefinitionSchema = z.strictObject({
  field: z.enum(["financialAmount", "severity", "owner"]),
  operator: z.enum(["gte", "eq"]),
  value: z.union([z.number(), z.string().trim().min(1)]),
});

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
