import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    // Business Profile (0017): seeded defaults an organization can adjust,
    // not a setup gate. Consumed by apps/web/app/page.tsx (timezone
    // display), the HubSpot mapper (response-hours baseline for ingested
    // leads), and evaluateUntouchedLead via IntelligenceContext
    // (high-value threshold) — replaces three values that used to be
    // hardcoded platform-wide.
    timezone: text("timezone").notNull().default("UTC"),
    defaultExpectedResponseHours: integer("default_expected_response_hours")
      .notNull()
      .default(24),
    highValueThresholdCents: bigint("high_value_threshold_cents", {
      mode: "number",
    })
      .notNull()
      .default(1_000_000),
    // Bit n (0 = Sunday, matching JS Date.getUTCDay()) set means day n is a
    // working day (0018). Default 62 = 0b0111110 = Mon-Fri. Consumed by
    // evaluateUntouchedLead via IntelligenceContext so elapsed-time
    // calculations count only the organization's own working days, not
    // every calendar day.
    workingDaysBitmask: smallint("working_days_bitmask").notNull().default(62),
    // Notification preferences (0021): scoped to the organization, not the
    // signed-in user — today's identity model provisions exactly one owner
    // per organization (no team invites yet), so there is no real
    // distinction yet between org-level and per-user preferences. Defaults
    // match what the Preferences card already showed as examples before
    // this was real.
    morningBriefEnabled: boolean("morning_brief_enabled")
      .notNull()
      .default(true),
    attentionAlertsEnabled: boolean("attention_alerts_enabled")
      .notNull()
      .default(true),
    weeklyRecapEnabled: boolean("weekly_recap_enabled")
      .notNull()
      .default(false),
    ...timestamps,
  },
  (table) => [
    unique("organizations_slug_unique").on(table.slug),
    check(
      "organizations_slug_not_blank",
      sql`length(btrim(${table.slug})) > 0`,
    ),
    check(
      "organizations_display_name_not_blank",
      sql`length(btrim(${table.displayName})) > 0`,
    ),
    check(
      "organizations_timezone_not_blank",
      sql`length(btrim(${table.timezone})) > 0`,
    ),
    check(
      "organizations_response_hours_positive",
      sql`${table.defaultExpectedResponseHours} > 0`,
    ),
    check(
      "organizations_threshold_nonnegative",
      sql`${table.highValueThresholdCents} >= 0`,
    ),
    check(
      "organizations_working_days_bitmask_range",
      sql`${table.workingDaysBitmask} between 0 and 127`,
    ),
  ],
);

// Users are global identities. Tenant access is always mediated by memberships.
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identityProvider: text("identity_provider").notNull(),
    identityProviderSubject: text("identity_provider_subject").notNull(),
    displayName: text("display_name").notNull(),
    primaryEmail: text("primary_email"),
    ...timestamps,
  },
  (table) => [
    unique("users_identity_provider_subject_unique").on(
      table.identityProvider,
      table.identityProviderSubject,
    ),
    check(
      "users_identity_provider_not_blank",
      sql`length(btrim(${table.identityProvider})) > 0`,
    ),
    check(
      "users_identity_subject_not_blank",
      sql`length(btrim(${table.identityProviderSubject})) > 0`,
    ),
    check(
      "users_display_name_not_blank",
      sql`length(btrim(${table.displayName})) > 0`,
    ),
  ],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    ...timestamps,
  },
  (table) => [
    unique("memberships_org_id_id_unique").on(table.organizationId, table.id),
    unique("memberships_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("memberships_user_id_index").on(table.userId),
    check(
      "memberships_role_allowed",
      sql`${table.role} in ('owner', 'admin', 'member', 'viewer')`,
    ),
    check(
      "memberships_status_allowed",
      sql`${table.status} in ('invited', 'active', 'suspended', 'revoked')`,
    ),
  ],
);

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceSystem: text("source_system").notNull(),
    externalAccountId: text("external_account_id").notNull(),
    status: text("status").notNull().default("active"),
    // Never the tokens themselves — only the Vault secret's id. Only
    // store_integration_tokens()/get_integration_tokens() (0019) may read
    // or write the decrypted value.
    tokenVaultSecretId: uuid("token_vault_secret_id"),
    // Human-readable "which account/workspace is this" (0020) — e.g. a
    // Slack team name. Nullable: not every provider's OAuth response
    // returns one (HubSpot's token exchange doesn't), so this stays
    // honestly unset rather than guessed at.
    externalAccountLabel: text("external_account_label"),
    ...timestamps,
  },
  (table) => [
    unique("integrations_org_id_source_system_unique").on(
      table.organizationId,
      table.id,
      table.sourceSystem,
    ),
    unique("integrations_org_source_account_unique").on(
      table.organizationId,
      table.sourceSystem,
      table.externalAccountId,
    ),
    index("integrations_org_status_index").on(
      table.organizationId,
      table.status,
    ),
    check(
      "integrations_source_system_not_blank",
      sql`length(btrim(${table.sourceSystem})) > 0`,
    ),
    check(
      "integrations_external_account_id_not_blank",
      sql`length(btrim(${table.externalAccountId})) > 0`,
    ),
    check(
      "integrations_status_allowed",
      sql`${table.status} in ('pending', 'active', 'degraded', 'disconnected', 'revoked')`,
    ),
  ],
);

export const sourceRecords = pgTable(
  "source_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id").notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceObjectType: text("source_object_type").notNull(),
    externalRecordId: text("external_record_id").notNull(),
    sourceVersion: text("source_version").notNull(),
    sourceSchemaVersion: integer("source_schema_version").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", {
      mode: "date",
      withTimezone: true,
    }),
    observedAt: timestamp("observed_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    ingestedAt: timestamp("ingested_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    rawPayloadSha256: text("raw_payload_sha256").notNull(),
    rawPayloadByteLength: bigint("raw_payload_byte_length", {
      mode: "bigint",
    }).notNull(),
    rawPayloadContentType: text("raw_payload_content_type"),
    rawPayloadStorageKey: text("raw_payload_storage_key"),
    rawPayloadRetainUntil: timestamp("raw_payload_retain_until", {
      mode: "date",
      withTimezone: true,
    }),
    rawPayloadDeletedAt: timestamp("raw_payload_deleted_at", {
      mode: "date",
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    unique("source_records_org_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("source_records_org_integration_external_version_unique").on(
      table.organizationId,
      table.integrationId,
      table.sourceSystem,
      table.sourceObjectType,
      table.externalRecordId,
      table.sourceVersion,
    ),
    unique("source_records_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("source_records_org_observed_at_index").on(
      table.organizationId,
      table.observedAt,
    ),
    foreignKey({
      name: "source_records_org_integration_source_fk",
      columns: [table.organizationId, table.integrationId, table.sourceSystem],
      foreignColumns: [
        integrations.organizationId,
        integrations.id,
        integrations.sourceSystem,
      ],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    check(
      "source_records_source_system_not_blank",
      sql`length(btrim(${table.sourceSystem})) > 0`,
    ),
    check(
      "source_records_source_object_type_not_blank",
      sql`length(btrim(${table.sourceObjectType})) > 0`,
    ),
    check(
      "source_records_external_record_id_not_blank",
      sql`length(btrim(${table.externalRecordId})) > 0`,
    ),
    check(
      "source_records_source_version_not_blank",
      sql`length(btrim(${table.sourceVersion})) > 0`,
    ),
    check(
      "source_records_idempotency_key_not_blank",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    check(
      "source_records_schema_version_positive",
      sql`${table.sourceSchemaVersion} > 0`,
    ),
    check(
      "source_records_payload_sha256_format",
      sql`${table.rawPayloadSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "source_records_payload_length_nonnegative",
      sql`${table.rawPayloadByteLength} >= 0`,
    ),
    check(
      "source_records_payload_storage_has_retention",
      sql`${table.rawPayloadStorageKey} is null or ${table.rawPayloadRetainUntil} is not null`,
    ),
    check(
      "source_records_deleted_payload_not_stored",
      sql`${table.rawPayloadDeletedAt} is null or ${table.rawPayloadStorageKey} is null`,
    ),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id").notNull(),
    ownerMembershipId: uuid("owner_membership_id"),
    contactName: text("contact_name").notNull(),
    companyName: text("company_name"),
    stage: text("stage").notNull(),
    valueCents: bigint("value_cents", { mode: "bigint" }),
    currency: text("currency"),
    expectedResponseHours: integer("expected_response_hours").notNull(),
    sourceCreatedAt: timestamp("source_created_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    lastInteractionAt: timestamp("last_interaction_at", {
      mode: "date",
      withTimezone: true,
    }),
    canonicalSchemaVersion: integer("canonical_schema_version").notNull(),
    normalizationVersion: text("normalization_version").notNull(),
    normalizedAt: timestamp("normalized_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    unique("leads_org_id_id_unique").on(table.organizationId, table.id),
    unique("leads_org_source_record_unique").on(
      table.organizationId,
      table.sourceRecordId,
    ),
    unique("leads_org_id_source_record_unique").on(
      table.organizationId,
      table.id,
      table.sourceRecordId,
    ),
    foreignKey({
      name: "leads_org_source_record_fk",
      columns: [table.organizationId, table.sourceRecordId],
      foreignColumns: [sourceRecords.organizationId, sourceRecords.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "leads_org_owner_membership_fk",
      columns: [table.organizationId, table.ownerMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("leads_org_stage_index").on(table.organizationId, table.stage),
    index("leads_org_owner_membership_index").on(
      table.organizationId,
      table.ownerMembershipId,
    ),
    check(
      "leads_contact_name_not_blank",
      sql`length(btrim(${table.contactName})) > 0`,
    ),
    check(
      "leads_expected_response_hours_positive",
      sql`${table.expectedResponseHours} > 0`,
    ),
    check(
      "leads_canonical_schema_version_positive",
      sql`${table.canonicalSchemaVersion} > 0`,
    ),
    check(
      "leads_value_currency_pair",
      sql`(${table.valueCents} is null and ${table.currency} is null) or (${table.valueCents} is not null and ${table.currency} is not null)`,
    ),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id").notNull(),
    customerName: text("customer_name").notNull(),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    dueAt: timestamp("due_at", { mode: "date", withTimezone: true }).notNull(),
    status: text("status").notNull(),
    canonicalSchemaVersion: integer("canonical_schema_version").notNull(),
    normalizationVersion: text("normalization_version").notNull(),
    normalizedAt: timestamp("normalized_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    unique("invoices_org_id_id_unique").on(table.organizationId, table.id),
    unique("invoices_org_source_record_unique").on(
      table.organizationId,
      table.sourceRecordId,
    ),
    foreignKey({
      name: "invoices_org_source_record_fk",
      columns: [table.organizationId, table.sourceRecordId],
      foreignColumns: [sourceRecords.organizationId, sourceRecords.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("invoices_org_status_due_index").on(
      table.organizationId,
      table.status,
      table.dueAt,
    ),
    check(
      "invoices_customer_name_not_blank",
      sql`length(btrim(${table.customerName})) > 0`,
    ),
    check("invoices_amount_nonnegative", sql`${table.amountCents} >= 0`),
    check("invoices_currency_format", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "invoices_status_allowed",
      sql`${table.status} in ('open', 'paid', 'void')`,
    ),
    check(
      "invoices_canonical_schema_version_positive",
      sql`${table.canonicalSchemaVersion} > 0`,
    ),
  ],
);

export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull().default("generated"),
    generatedBy: text("generated_by")
      .notNull()
      .default("deterministic-assembly"),
    content: text("content").notNull(),
    structuredData: jsonb("structured_data").notNull().default({}),
    sourceFindingIds: text("source_finding_ids").array().notNull().default([]),
    generatedAt: timestamp("generated_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("artifacts_org_type_generated_index").on(
      table.organizationId,
      table.type,
      table.generatedAt,
    ),
    check("artifacts_type_allowed", sql`${table.type} in ('daily_brief')`),
    check(
      "artifacts_status_allowed",
      sql`${table.status} in ('draft', 'generated', 'reviewed', 'approved', 'published', 'superseded', 'archived')`,
    ),
    check(
      "artifacts_generated_by_allowed",
      sql`${table.generatedBy} in ('deterministic-assembly')`,
    ),
    check("artifacts_title_not_blank", sql`length(btrim(${table.title})) > 0`),
    check(
      "artifacts_content_not_blank",
      sql`length(btrim(${table.content})) > 0`,
    ),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id").notNull(),
    name: text("name").notNull(),
    assigneeName: text("assignee_name"),
    dueAt: timestamp("due_at", { mode: "date", withTimezone: true }).notNull(),
    completed: boolean("completed").notNull(),
    canonicalSchemaVersion: integer("canonical_schema_version").notNull(),
    normalizationVersion: text("normalization_version").notNull(),
    normalizedAt: timestamp("normalized_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    unique("tasks_org_id_id_unique").on(table.organizationId, table.id),
    unique("tasks_org_source_record_unique").on(
      table.organizationId,
      table.sourceRecordId,
    ),
    foreignKey({
      name: "tasks_org_source_record_fk",
      columns: [table.organizationId, table.sourceRecordId],
      foreignColumns: [sourceRecords.organizationId, sourceRecords.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("tasks_org_completed_due_index").on(
      table.organizationId,
      table.completed,
      table.dueAt,
    ),
    check("tasks_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check(
      "tasks_canonical_schema_version_positive",
      sql`${table.canonicalSchemaVersion} > 0`,
    ),
  ],
);

export const signals = pgTable(
  "signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").notNull(),
    sourceRecordId: uuid("source_record_id").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("open"),
    headline: text("headline").notNull(),
    rationale: text("rationale").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    signalSchemaVersion: integer("signal_schema_version").notNull(),
    ruleVersion: text("rule_version").notNull(),
    evidenceDigest: text("evidence_digest").notNull(),
    sourceObservedAt: timestamp("source_observed_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    evaluatedAt: timestamp("evaluated_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    resolvedAt: timestamp("resolved_at", {
      mode: "date",
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    unique("signals_org_id_id_unique").on(table.organizationId, table.id),
    unique("signals_org_id_lead_source_unique").on(
      table.organizationId,
      table.id,
      table.leadId,
      table.sourceRecordId,
    ),
    unique("signals_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "signals_org_lead_source_fk",
      columns: [table.organizationId, table.leadId, table.sourceRecordId],
      foreignColumns: [leads.organizationId, leads.id, leads.sourceRecordId],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("signals_org_lead_source_index").on(
      table.organizationId,
      table.leadId,
      table.sourceRecordId,
    ),
    index("signals_org_status_evaluated_index").on(
      table.organizationId,
      table.status,
      table.evaluatedAt,
    ),
    check(
      "signals_status_allowed",
      sql`${table.status} in ('open', 'acknowledged', 'resolved', 'dismissed')`,
    ),
    check(
      "signals_schema_version_positive",
      sql`${table.signalSchemaVersion} > 0`,
    ),
    check(
      "signals_idempotency_key_not_blank",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    check(
      "signals_resolution_state_consistent",
      sql`(${table.status} in ('resolved', 'dismissed') and ${table.resolvedAt} is not null) or (${table.status} in ('open', 'acknowledged') and ${table.resolvedAt} is null)`,
    ),
  ],
);

export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    signalId: uuid("signal_id").notNull(),
    leadId: uuid("lead_id").notNull(),
    sourceRecordId: uuid("source_record_id").notNull(),
    status: text("status").notNull().default("active"),
    recommendedNextStep: text("recommended_next_step").notNull(),
    rationale: text("rationale").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    recommendationSchemaVersion: integer(
      "recommendation_schema_version",
    ).notNull(),
    generatorKind: text("generator_kind").notNull(),
    generatorVersion: text("generator_version").notNull(),
    confidenceBasisPoints: integer("confidence_basis_points"),
    sourceObservedAt: timestamp("source_observed_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    validUntil: timestamp("valid_until", {
      mode: "date",
      withTimezone: true,
    }),
    supersededAt: timestamp("superseded_at", {
      mode: "date",
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    unique("recommendations_org_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("recommendations_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "recommendations_org_signal_lead_source_fk",
      columns: [
        table.organizationId,
        table.signalId,
        table.leadId,
        table.sourceRecordId,
      ],
      foreignColumns: [
        signals.organizationId,
        signals.id,
        signals.leadId,
        signals.sourceRecordId,
      ],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("recommendations_org_signal_lead_source_index").on(
      table.organizationId,
      table.signalId,
      table.leadId,
      table.sourceRecordId,
    ),
    index("recommendations_org_status_index").on(
      table.organizationId,
      table.status,
    ),
    check(
      "recommendations_status_allowed",
      sql`${table.status} in ('active', 'accepted', 'dismissed', 'expired', 'superseded')`,
    ),
    check(
      "recommendations_generator_kind_allowed",
      sql`${table.generatorKind} in ('deterministic_rule', 'model_assisted')`,
    ),
    check(
      "recommendations_schema_version_positive",
      sql`${table.recommendationSchemaVersion} > 0`,
    ),
    check(
      "recommendations_idempotency_key_not_blank",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    check(
      "recommendations_confidence_range",
      sql`${table.confidenceBasisPoints} is null or (${table.confidenceBasisPoints} >= 0 and ${table.confidenceBasisPoints} <= 10000)`,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    actorMembershipId: uuid("actor_membership_id"),
    actorKind: text("actor_kind").notNull(),
    eventType: text("event_type").notNull(),
    eventSchemaVersion: integer("event_schema_version").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    sourceRecordId: uuid("source_record_id"),
    correlationId: text("correlation_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    outcome: text("outcome").notNull(),
    payloadDigest: text("payload_digest").notNull(),
    previousEventDigest: text("previous_event_digest"),
    eventDigest: text("event_digest").notNull(),
    metadata: jsonb("metadata").notNull(),
    retentionClass: text("retention_class").notNull(),
    retainUntil: timestamp("retain_until", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    occurredAt: timestamp("occurred_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    recordedAt: timestamp("recorded_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("audit_events_org_id_id_unique").on(table.organizationId, table.id),
    unique("audit_events_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    unique("audit_events_org_event_digest_unique").on(
      table.organizationId,
      table.eventDigest,
    ),
    foreignKey({
      name: "audit_events_org_actor_membership_fk",
      columns: [table.organizationId, table.actorMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "audit_events_org_source_record_fk",
      columns: [table.organizationId, table.sourceRecordId],
      foreignColumns: [sourceRecords.organizationId, sourceRecords.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("audit_events_org_recorded_at_index").on(
      table.organizationId,
      table.recordedAt,
    ),
    index("audit_events_org_correlation_index").on(
      table.organizationId,
      table.correlationId,
    ),
    index("audit_events_org_actor_membership_index").on(
      table.organizationId,
      table.actorMembershipId,
    ),
    index("audit_events_org_source_record_index").on(
      table.organizationId,
      table.sourceRecordId,
    ),
    check(
      "audit_events_actor_kind_allowed",
      sql`${table.actorKind} in ('user', 'system', 'integration')`,
    ),
    check(
      "audit_events_actor_membership_consistent",
      sql`(${table.actorKind} = 'user' and ${table.actorMembershipId} is not null) or (${table.actorKind} <> 'user' and ${table.actorMembershipId} is null)`,
    ),
    check(
      "audit_events_schema_version_positive",
      sql`${table.eventSchemaVersion} > 0`,
    ),
    check(
      "audit_events_idempotency_key_not_blank",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    check(
      "audit_events_outcome_allowed",
      sql`${table.outcome} in ('allowed', 'denied', 'succeeded', 'failed', 'recorded')`,
    ),
    check(
      "audit_events_retention_after_recording",
      sql`${table.retainUntil} > ${table.recordedAt}`,
    ),
  ],
);

export const internalTasks = pgTable(
  "internal_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("open"),
    sourceCardId: text("source_card_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("internal_tasks_org_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("internal_tasks_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("internal_tasks_org_status_index").on(
      table.organizationId,
      table.status,
    ),
    check(
      "internal_tasks_title_not_blank",
      sql`length(btrim(${table.title})) > 0`,
    ),
    check(
      "internal_tasks_status_allowed",
      sql`${table.status} in ('open', 'completed')`,
    ),
    check(
      "internal_tasks_idempotency_key_not_blank",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
  ],
);

// Billing (0022/0023): global catalog tables (plans/plan_prices/
// plan_entitlements/plan_addons) intentionally have no RLS — they're
// public pricing-page data, not tenant data. See 0022's migration header
// comment for the full reasoning.
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planKey: text("plan_key").notNull(),
    name: text("name").notNull(),
    tierOrder: smallint("tier_order").notNull(),
    isRecommended: boolean("is_recommended").notNull().default(false),
    isCustomPricing: boolean("is_custom_pricing").notNull().default(false),
    supportsSelfServeCheckout: boolean("supports_self_serve_checkout")
      .notNull()
      .default(true),
    differentiationSummary: text("differentiation_summary").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("plans_plan_key_unique").on(table.planKey),
    unique("plans_tier_order_unique").on(table.tierOrder),
    check("plans_plan_key_not_blank", sql`length(btrim(${table.planKey})) > 0`),
    check("plans_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const planPrices = pgTable(
  "plan_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    billingInterval: text("billing_interval").notNull(),
    // Null only for a plan's custom-pricing rows (Enterprise never gets a
    // plan_prices row at all today — see 0023's seed comment — but the
    // column stays nullable for a future negotiated-but-recorded price).
    amountCents: integer("amount_cents"),
    currency: text("currency").notNull().default("usd"),
    stripePriceIdTest: text("stripe_price_id_test"),
    stripePriceIdLive: text("stripe_price_id_live"),
    priceKind: text("price_kind").notNull().default("standard"),
    promoKey: text("promo_key"),
    promoMaxRedemptions: integer("promo_max_redemptions"),
    promoRedemptionsCount: integer("promo_redemptions_count")
      .notNull()
      .default(0),
    promoStartsAt: timestamp("promo_starts_at", {
      mode: "date",
      withTimezone: true,
    }),
    promoEndsAt: timestamp("promo_ends_at", {
      mode: "date",
      withTimezone: true,
    }),
    isActiveForNewCheckouts: boolean("is_active_for_new_checkouts")
      .notNull()
      .default(true),
    effectiveFrom: timestamp("effective_from", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    effectiveTo: timestamp("effective_to", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("plan_prices_plan_id_index").on(table.planId),
    // A plain unique constraint, not a partial index: Postgres already
    // treats NULL as never equal to another NULL, so this enforces
    // "unique among non-null promo keys" without needing a WHERE clause.
    unique("plan_prices_promo_key_unique").on(table.promoKey),
    check(
      "plan_prices_billing_interval_allowed",
      sql`${table.billingInterval} in ('month', 'year')`,
    ),
    check(
      "plan_prices_price_kind_allowed",
      sql`${table.priceKind} in ('standard', 'promotional')`,
    ),
    check(
      "plan_prices_amount_nonnegative",
      sql`${table.amountCents} is null or ${table.amountCents} >= 0`,
    ),
    check(
      "plan_prices_promo_redemptions_nonnegative",
      sql`${table.promoRedemptionsCount} >= 0`,
    ),
    check(
      "plan_prices_promo_key_requires_promotional",
      sql`(${table.priceKind} = 'promotional' and ${table.promoKey} is not null) or (${table.priceKind} = 'standard' and ${table.promoKey} is null)`,
    ),
    check(
      "plan_prices_promo_key_not_blank",
      sql`${table.promoKey} is null or length(btrim(${table.promoKey})) > 0`,
    ),
  ],
);

export const planEntitlements = pgTable(
  "plan_entitlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    // Null means negotiated/unbounded (Enterprise) — never a real limit of
    // zero, which is expressed as the number 0 instead.
    includedUsers: integer("included_users"),
    includedActiveConnections: integer("included_active_connections"),
    capabilityFlags: jsonb("capability_flags").notNull().default({}),
    effectiveFrom: timestamp("effective_from", {
      mode: "date",
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    effectiveTo: timestamp("effective_to", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("plan_entitlements_plan_id_index").on(table.planId),
    check(
      "plan_entitlements_users_nonnegative",
      sql`${table.includedUsers} is null or ${table.includedUsers} >= 0`,
    ),
    check(
      "plan_entitlements_connections_nonnegative",
      sql`${table.includedActiveConnections} is null or ${table.includedActiveConnections} >= 0`,
    ),
  ],
);

export const planAddons = pgTable(
  "plan_addons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    addonKey: text("addon_key").notNull(),
    name: text("name").notNull(),
    grantsUsers: integer("grants_users").notNull().default(0),
    grantsActiveConnections: integer("grants_active_connections")
      .notNull()
      .default(0),
    amountCents: integer("amount_cents").notNull(),
    billingInterval: text("billing_interval").notNull().default("month"),
    stripePriceIdTest: text("stripe_price_id_test"),
    stripePriceIdLive: text("stripe_price_id_live"),
    // The explicit "easy to disable" toggle — flip to false to stop
    // offering this add-on to new checkouts without deleting the row (or
    // its price history) that existing subscribers may still reference.
    isEnabled: boolean("is_enabled").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    unique("plan_addons_addon_key_unique").on(table.addonKey),
    check(
      "plan_addons_addon_key_not_blank",
      sql`length(btrim(${table.addonKey})) > 0`,
    ),
    check(
      "plan_addons_billing_interval_allowed",
      sql`${table.billingInterval} in ('month', 'year')`,
    ),
    check("plan_addons_amount_nonnegative", sql`${table.amountCents} >= 0`),
    check(
      "plan_addons_grants_something",
      sql`${table.grantsUsers} > 0 or ${table.grantsActiveConnections} > 0`,
    ),
  ],
);

export const organizationSubscriptions = pgTable(
  "organization_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    // The specific price version/promo this org is locked into —
    // grandfathering. Changing plans updates this; the plan itself never
    // needs to change shape for a price change.
    planPriceId: uuid("plan_price_id").references(() => planPrices.id, {
      onDelete: "restrict",
    }),
    status: text("status").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeMode: text("stripe_mode").notNull(),
    trialEndsAt: timestamp("trial_ends_at", {
      mode: "date",
      withTimezone: true,
    }),
    currentPeriodStart: timestamp("current_period_start", {
      mode: "date",
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", {
      mode: "date",
      withTimezone: true,
    }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", {
      mode: "date",
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    unique("organization_subscriptions_org_unique").on(table.organizationId),
    index("organization_subscriptions_stripe_subscription_id_index").on(
      table.stripeSubscriptionId,
    ),
    index("organization_subscriptions_stripe_customer_id_index").on(
      table.stripeCustomerId,
    ),
    check(
      "organization_subscriptions_status_allowed",
      sql`${table.status} in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'paused', 'unpaid')`,
    ),
    check(
      "organization_subscriptions_stripe_mode_allowed",
      sql`${table.stripeMode} in ('test', 'live')`,
    ),
  ],
);

export const organizationSubscriptionAddons = pgTable(
  "organization_subscription_addons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationSubscriptionId: uuid("organization_subscription_id")
      .notNull()
      .references(() => organizationSubscriptions.id, {
        onDelete: "cascade",
      }),
    planAddonId: uuid("plan_addon_id")
      .notNull()
      .references(() => planAddons.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    stripeSubscriptionItemId: text("stripe_subscription_item_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("organization_subscription_addons_unique").on(
      table.organizationSubscriptionId,
      table.planAddonId,
    ),
    check(
      "organization_subscription_addons_quantity_positive",
      sql`${table.quantity} > 0`,
    ),
  ],
);

// Internal-only unit-economics instrumentation — never customer-facing
// metering (see 0022's migration header comment). Nothing writes to this
// table yet: no real AI-orchestration or connector-sync pipeline exists
// in this codebase today to generate real cost events from.
export const internalCostEvents = pgTable(
  "internal_cost_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    quantity: numeric("quantity", { mode: "number" }).notNull().default(1),
    estimatedCostCents: integer("estimated_cost_cents"),
    metadata: jsonb("metadata").notNull().default({}),
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("internal_cost_events_org_occurred_index").on(
      table.organizationId,
      table.occurredAt,
    ),
    check(
      "internal_cost_events_event_type_not_blank",
      sql`length(btrim(${table.eventType})) > 0`,
    ),
    check("internal_cost_events_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export type OrganizationRow = typeof organizations.$inferSelect;
export type NewOrganizationRow = typeof organizations.$inferInsert;
export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type MembershipRow = typeof memberships.$inferSelect;
export type NewMembershipRow = typeof memberships.$inferInsert;
export type IntegrationRow = typeof integrations.$inferSelect;
export type NewIntegrationRow = typeof integrations.$inferInsert;
export type SourceRecordRow = typeof sourceRecords.$inferSelect;
export type NewSourceRecordRow = typeof sourceRecords.$inferInsert;
export type LeadRow = typeof leads.$inferSelect;
export type NewLeadRow = typeof leads.$inferInsert;
export type InvoiceRow = typeof invoices.$inferSelect;
export type NewInvoiceRow = typeof invoices.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
export type ArtifactRow = typeof artifacts.$inferSelect;
export type NewArtifactRow = typeof artifacts.$inferInsert;
export type SignalRow = typeof signals.$inferSelect;
export type NewSignalRow = typeof signals.$inferInsert;
export type RecommendationRow = typeof recommendations.$inferSelect;
export type NewRecommendationRow = typeof recommendations.$inferInsert;
export type AuditEventRow = typeof auditEvents.$inferSelect;
export type NewAuditEventRow = typeof auditEvents.$inferInsert;
export type InternalTaskRow = typeof internalTasks.$inferSelect;
export type NewInternalTaskRow = typeof internalTasks.$inferInsert;
export type PlanRow = typeof plans.$inferSelect;
export type NewPlanRow = typeof plans.$inferInsert;
export type PlanPriceRow = typeof planPrices.$inferSelect;
export type NewPlanPriceRow = typeof planPrices.$inferInsert;
export type PlanEntitlementRow = typeof planEntitlements.$inferSelect;
export type NewPlanEntitlementRow = typeof planEntitlements.$inferInsert;
export type PlanAddonRow = typeof planAddons.$inferSelect;
export type NewPlanAddonRow = typeof planAddons.$inferInsert;
export type OrganizationSubscriptionRow =
  typeof organizationSubscriptions.$inferSelect;
export type NewOrganizationSubscriptionRow =
  typeof organizationSubscriptions.$inferInsert;
export type OrganizationSubscriptionAddonRow =
  typeof organizationSubscriptionAddons.$inferSelect;
export type NewOrganizationSubscriptionAddonRow =
  typeof organizationSubscriptionAddons.$inferInsert;
export type InternalCostEventRow = typeof internalCostEvents.$inferSelect;
export type NewInternalCostEventRow = typeof internalCostEvents.$inferInsert;
