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
    // Set only by anonymize_organization() (0032) — a real "delete my
    // organization" request. A deactivated org can never resolve to a
    // valid session again (resolve_memberships_for_identity excludes it),
    // but its row and audit trail survive, matching ADR 0003's provenance
    // principle. See ADR 0018.
    deactivatedAt: timestamp("deactivated_at", {
      mode: "date",
      withTimezone: true,
    }),
    // "unspecified" (default) or "professional_services" (0033/ADR 0019) —
    // used only to recommend which ConnectorPurposes matter most on the
    // /integrations Business Data Map. See `industryProfiles` in
    // @signaldesk/integrations for the one real profile.
    industry: text("industry").notNull().default("unspecified"),
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
    check(
      "organizations_industry_allowed",
      sql`${table.industry} in ('unspecified', 'professional_services')`,
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
    // Which of this connector's declared capability ids this connection
    // has enabled (ADR 0021/ConnectorSettings) — empty by default, since
    // no connector has a real write action to gate yet. Not wired to any
    // UI in this pass; see connector-settings.ts's doc comment.
    enabledCapabilityIds: text("enabled_capability_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
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

// One row per real sync run (ADR 0021) — observability for the three
// connectors with a real one-time sync-on-connect (HubSpot, QuickBooks,
// Asana). Tracks status/counts/timing and a computed cursor value without
// wiring that cursor into the fetch query yet — see
// ConnectorReadiness.incrementalSyncImplemented, @signaldesk/integrations.
export const syncJobs = pgTable(
  "sync_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id").notNull(),
    sourceSystem: text("source_system").notNull(),
    // Which canonical entity this run synced — distinct from sourceSystem
    // (FK'd to the connector's own source_system, so it can't double as an
    // entity discriminator). Added when QuickBooks gained a second synced
    // entity type (payments, alongside invoices) under the same
    // source_system: without this, "the previous run's cursorAfter" would
    // read whichever entity type happened to sync most recently, silently
    // corrupting the other entity's incremental-sync cursor.
    entityType: text("entity_type").notNull(),
    trigger: text("trigger").notNull(),
    status: text("status").notNull().default("running"),
    itemsIngested: integer("items_ingested").notNull().default(0),
    itemsSkipped: integer("items_skipped").notNull().default(0),
    cursorBefore: text("cursor_before"),
    cursorAfter: text("cursor_after"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (table) => [
    // Lets source_records reference a specific run (Prompt 12,
    // docs/product-vision-backlog.md, ADR 0029) — a real trace identity
    // from "which sync run produced this record," reusing this row's own
    // id rather than inventing a parallel correlation-id string.
    unique("sync_jobs_org_id_id_unique").on(table.organizationId, table.id),
    // Covers sync_jobs_org_integration_source_fk — flagged by Supabase's
    // performance advisor as an unindexed foreign key (frontend/backend
    // audit follow-up, 2026-08-21): the existing started-at index below
    // shares this FK's first two columns but not its third
    // (source_system), so it isn't a full covering index for this FK.
    index("sync_jobs_org_integration_source_index").on(
      table.organizationId,
      table.integrationId,
      table.sourceSystem,
    ),
    index("sync_jobs_org_integration_started_index").on(
      table.organizationId,
      table.integrationId,
      table.startedAt,
    ),
    foreignKey({
      name: "sync_jobs_org_integration_source_fk",
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
      "sync_jobs_source_system_not_blank",
      sql`length(btrim(${table.sourceSystem})) > 0`,
    ),
    check(
      "sync_jobs_trigger_allowed",
      sql`${table.trigger} in ('initial', 'manual', 'webhook')`,
    ),
    check(
      "sync_jobs_entity_type_allowed",
      sql`${table.entityType} in ('lead', 'invoice', 'payment', 'task', 'message', 'support_ticket')`,
    ),
    check(
      "sync_jobs_status_allowed",
      sql`${table.status} in ('running', 'succeeded', 'failed')`,
    ),
    check(
      "sync_jobs_items_ingested_nonnegative",
      sql`${table.itemsIngested} >= 0`,
    ),
    check(
      "sync_jobs_items_skipped_nonnegative",
      sql`${table.itemsSkipped} >= 0`,
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
    // Which sync_jobs run produced this record (Prompt 12,
    // docs/product-vision-backlog.md, ADR 0029) — a real trace identity
    // from provider event through normalization, using the run's own id
    // rather than a parallel correlation-id string. Nullable: rows
    // ingested before this column existed have no run to point back to.
    syncJobId: uuid("sync_job_id"),
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
    index("source_records_org_sync_job_index").on(
      table.organizationId,
      table.syncJobId,
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
    foreignKey({
      name: "source_records_org_sync_job_fk",
      columns: [table.organizationId, table.syncJobId],
      foreignColumns: [syncJobs.organizationId, syncJobs.id],
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
    // Real plumbing, honestly unpopulated by any ingest function today
    // (Phase 4b, implementation roadmap) — mapHubSpotDealToSourceLeadRecord
    // never calls the Associations/Contacts API, so this stays null for
    // every real lead until a separately-scoped "HubSpot contact-email
    // enrichment" phase ships. Exists now so messages.lead_id has a real
    // column to resolve against, the same "real column, disclosed as
    // unpopulated" pattern source_records.rawPayloadStorageKey already
    // established.
    contactEmail: text("contact_email"),
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
    check(
      "leads_contact_email_not_blank_when_present",
      sql`${table.contactEmail} is null or length(btrim(${table.contactEmail})) > 0`,
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

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id").notNull(),
    customerName: text("customer_name").notNull(),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    receivedAt: timestamp("received_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    invoiceAllocations: jsonb("invoice_allocations")
      .notNull()
      .default(sql`'[]'::jsonb`),
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
    unique("payments_org_id_id_unique").on(table.organizationId, table.id),
    unique("payments_org_source_record_unique").on(
      table.organizationId,
      table.sourceRecordId,
    ),
    foreignKey({
      name: "payments_org_source_record_fk",
      columns: [table.organizationId, table.sourceRecordId],
      foreignColumns: [sourceRecords.organizationId, sourceRecords.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("payments_org_received_index").on(
      table.organizationId,
      table.receivedAt,
    ),
    check(
      "payments_customer_name_not_blank",
      sql`length(btrim(${table.customerName})) > 0`,
    ),
    check("payments_amount_nonnegative", sql`${table.amountCents} >= 0`),
    check("payments_currency_format", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "payments_canonical_schema_version_positive",
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
    // Real gap found by review: the morning-brief cron's "already
    // generated today" check (a separate SELECT, then an unconditional
    // INSERT) was a non-atomic check-then-act, despite that route's own
    // doc comment explicitly claiming idempotency and acknowledging that
    // Vercel Cron delivery "can duplicate-invoke." Nullable — only the
    // cron path sets one (`daily-brief:{utcDate}`); the user-triggered
    // "Generate my brief"/"Since you left" actions intentionally create a
    // fresh artifact on every real click and never set this, which is
    // why this can't be `.notNull()` the way every other idempotency-key
    // column in this schema is (those tables have no legitimate
    // "no key" case the way this one does).
    idempotencyKey: text("idempotency_key"),
    ...timestamps,
  },
  (table) => [
    index("artifacts_org_type_generated_index").on(
      table.organizationId,
      table.type,
      table.generatedAt,
    ),
    // A plain (non-partial) unique constraint on a nullable column is
    // exactly what's needed here: Postgres never considers two NULLs
    // equal for uniqueness purposes, so every user-triggered artifact
    // (idempotency_key left null) stays completely unconstrained, while
    // any two cron-generated artifacts that ever share the same
    // (organization_id, idempotency_key) collide at the database level —
    // the real atomicity guarantee no advisory lock or app-level check
    // can fully provide against a genuinely concurrent duplicate cron
    // invocation.
    unique("artifacts_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
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
    // Ownership Engine (Prompt 29, docs/product-vision-backlog.md, ADR
    // 0039) — resolved at ingest time from `assigneeName` via
    // `resolveMembershipIdByDisplayName` (an exact, case-insensitive
    // display-name match; `null` when no real member's name matches).
    // Mirrors `leads.ownerMembershipId`'s own shape, but unlike that
    // column (declared in ADR 0003 and still never populated by any real
    // HubSpot ingest path today), this one is actually written.
    ownerMembershipId: uuid("owner_membership_id"),
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
    foreignKey({
      name: "tasks_org_owner_membership_fk",
      columns: [table.organizationId, table.ownerMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("tasks_org_completed_due_index").on(
      table.organizationId,
      table.completed,
      table.dueAt,
    ),
    // Covers tasks_org_owner_membership_fk — flagged by Supabase's
    // performance advisor as an unindexed foreign key (frontend/backend
    // audit follow-up, 2026-08-21).
    index("tasks_org_owner_membership_index").on(
      table.organizationId,
      table.ownerMembershipId,
    ),
    check("tasks_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check(
      "tasks_canonical_schema_version_positive",
      sql`${table.canonicalSchemaVersion} > 0`,
    ),
  ],
);

// A real, ingested email message (Phase 4b, implementation roadmap) — the
// first canonical entity whose value is close to its raw content rather
// than a small structured summary of it (unlike leads/invoices/tasks).
// `bodyPreview` deliberately has no query function in this package that
// ever selects it for anything above the ingest path itself — see
// messages.ts's own doc comment. `leadId` resolves via `leads.contactEmail`
// at ingest time and is honestly expected to be null for effectively every
// row today, since no ingest function populates that column yet.
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id").notNull(),
    leadId: uuid("lead_id"),
    externalThreadId: text("external_thread_id").notNull(),
    direction: text("direction").notNull(),
    counterpartyEmail: text("counterparty_email").notNull(),
    counterpartyName: text("counterparty_name"),
    subject: text("subject").notNull(),
    snippet: text("snippet"),
    // Deterministically extracted, hard-truncated (5,000 chars) plain
    // text — real evidentiary content for a future extraction phase, but
    // never selected by any query above the ingest path (see messages.ts).
    // No field-level encryption beyond ordinary tenant RLS protects this —
    // a real, disclosed limitation, see docs/adr/0050-gmail-message-
    // ingestion.md.
    bodyPreview: text("body_preview"),
    bodyTruncated: boolean("body_truncated").notNull().default(false),
    occurredAt: timestamp("occurred_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    // Real plumbing (application-set at ingest, not a DB default) — no
    // reaper enforces this yet; Vercel Cron is the named future mechanism.
    retainUntil: timestamp("retain_until", {
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
    unique("messages_org_id_id_unique").on(table.organizationId, table.id),
    unique("messages_org_source_record_unique").on(
      table.organizationId,
      table.sourceRecordId,
    ),
    foreignKey({
      name: "messages_org_source_record_fk",
      columns: [table.organizationId, table.sourceRecordId],
      foreignColumns: [sourceRecords.organizationId, sourceRecords.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "messages_org_lead_fk",
      columns: [table.organizationId, table.leadId],
      foreignColumns: [leads.organizationId, leads.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("messages_org_occurred_at_index").on(
      table.organizationId,
      table.occurredAt,
    ),
    index("messages_org_thread_occurred_index").on(
      table.organizationId,
      table.externalThreadId,
      table.occurredAt,
    ),
    index("messages_org_lead_index").on(table.organizationId, table.leadId),
    check(
      "messages_direction_allowed",
      sql`${table.direction} in ('inbound', 'outbound')`,
    ),
    check(
      "messages_external_thread_id_not_blank",
      sql`length(btrim(${table.externalThreadId})) > 0`,
    ),
    check(
      "messages_counterparty_email_not_blank",
      sql`length(btrim(${table.counterpartyEmail})) > 0`,
    ),
    check(
      "messages_subject_not_blank",
      sql`length(btrim(${table.subject})) > 0`,
    ),
    check(
      "messages_canonical_schema_version_positive",
      sql`${table.canonicalSchemaVersion} > 0`,
    ),
  ],
);

// A real, ingested support ticket (first shipped for Zendesk) — the first
// canonical entity added after `messages`, and the first support-domain
// entity in this Business Graph at all (docs/product-vision-backlog.md's
// "Customer Operations Intelligence" entry confirms no `Customer`/
// `Account`/`Contact` entity exists yet). Deliberately carries no
// cross-entity link the way `messages.leadId` does — `requester_name` is
// plain free text, not a resolved relationship, since there is no
// `Customer` entity to resolve it against. `owner_membership_id` reuses
// the exact Ownership Engine pattern `tasks.owner_membership_id` already
// established (Prompt 29, ADR 0039): resolved at ingest time from
// `assignee_name` via `resolveMembershipIdByDisplayName`. `due_at` is
// honestly nullable — real Zendesk tickets only carry a due date for
// "task"-type tickets, a minority case; `last_activity_at` (the source's
// own `updated_at`) is what the stuck-ticket risk evaluator actually keys
// on, not `due_at` — see `evaluateTicketStuck` (`@signaldesk/domain`).
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceRecordId: uuid("source_record_id").notNull(),
    subject: text("subject").notNull(),
    status: text("status").notNull(),
    priority: text("priority"),
    requesterName: text("requester_name"),
    assigneeName: text("assignee_name"),
    ownerMembershipId: uuid("owner_membership_id"),
    dueAt: timestamp("due_at", { mode: "date", withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
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
    unique("support_tickets_org_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("support_tickets_org_source_record_unique").on(
      table.organizationId,
      table.sourceRecordId,
    ),
    foreignKey({
      name: "support_tickets_org_source_record_fk",
      columns: [table.organizationId, table.sourceRecordId],
      foreignColumns: [sourceRecords.organizationId, sourceRecords.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "support_tickets_org_owner_membership_fk",
      columns: [table.organizationId, table.ownerMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("support_tickets_org_status_activity_index").on(
      table.organizationId,
      table.status,
      table.lastActivityAt,
    ),
    // Covers support_tickets_org_owner_membership_fk — matching the same
    // unindexed-FK advisor finding tasks_org_owner_membership_index was
    // added to fix.
    index("support_tickets_org_owner_membership_index").on(
      table.organizationId,
      table.ownerMembershipId,
    ),
    check(
      "support_tickets_subject_not_blank",
      sql`length(btrim(${table.subject})) > 0`,
    ),
    check(
      "support_tickets_status_allowed",
      sql`${table.status} in ('new', 'open', 'pending', 'hold', 'solved', 'closed')`,
    ),
    check(
      "support_tickets_priority_allowed",
      sql`${table.priority} is null or ${table.priority} in ('urgent', 'high', 'normal', 'low')`,
    ),
    check(
      "support_tickets_canonical_schema_version_positive",
      sql`${table.canonicalSchemaVersion} > 0`,
    ),
  ],
);

/**
 * `signals` and `recommendations` (below): real, RLS-forced, tested-at-the-
 * constraint-level DDL with zero application code writing to either one
 * and zero test coverage exercising them — a real, disclosed gap
 * (`SIGNALDESK_SYSTEM_CERTIFICATION.md`'s inventory names this explicitly,
 * confirmed still true on re-check, not newly discovered).
 *
 * Investigated why, not just re-flagged: this table's shape (`kind`,
 * `headline`, `rationale`, `evidenceDigest`, `ruleVersion`, evaluated-at)
 * is a persisted, durable-row design for exactly what
 * `@signaldesk/intelligence`'s `IntelligenceFinding` now computes fresh
 * on every page load instead — and `recommendations`'s shape
 * (`recommendedNextStep`, `generatorKind: 'deterministic_rule' |
 * 'model_assisted'`, a confidence/validity window) is the same durable-row
 * treatment of what `ActionProposal`/`IntelligenceCard.recommendedActions`
 * now compute live. Read as evidence this repo's own real architecture
 * evolved from "persist a signal, then a recommendation off it" to
 * "recompute both live from source data on every read" — a real, working,
 * simpler design (no staleness between a stored signal and the data it
 * describes) that this schema predates, not an unfinished feature waiting
 * for a writer.
 *
 * Do not wire a writer to these as-is: doing so would stand up a second,
 * competing persistence mechanism for exactly what `IntelligenceCapability`
 * already does — the "extend, don't duplicate" principle this repo's own
 * `CLAUDE.md` states applies here directly. If a real future need for
 * durable (not recomputed) signals ever arises — e.g. an audit requirement
 * to prove what was shown to a user at a specific past moment — design
 * that against a real requirement then, reusing this shape if it still
 * fits, rather than inventing a reason to populate it now.
 */
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

// A real, narrow first slice of Adaptive Attention (Prompt 17,
// docs/product-vision-backlog.md, ADR 0032) — deliberately not built on
// top of `signals`/`recommendations` above: both are real DDL with zero
// application code anywhere (a genuine orphaned-table finding made while
// building this table — see README's Priority 0 item 5), and a human's
// reaction to a finding is a different concept than the finding itself,
// not an extension of either. `findingId` is the deterministic id every
// IntelligenceCapability already produces
// (`{capabilityId}:{organizationId}:{entityId}`) — no persisted Signal
// entity is required for feedback to attach to something stable.
export const cardFeedback = pgTable(
  "card_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id").notNull(),
    findingId: text("finding_id").notNull(),
    cardType: text("card_type").notNull(),
    feedback: text("feedback").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("card_feedback_org_id_id_unique").on(table.organizationId, table.id),
    foreignKey({
      name: "card_feedback_org_membership_fk",
      columns: [table.organizationId, table.membershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("card_feedback_org_finding_index").on(
      table.organizationId,
      table.findingId,
    ),
    // Covers card_feedback_org_membership_fk — flagged by Supabase's
    // performance advisor as an unindexed foreign key (frontend/backend
    // audit follow-up, 2026-08-21).
    index("card_feedback_org_membership_index").on(
      table.organizationId,
      table.membershipId,
    ),
    // Backs listRecentCardFeedback's `order by created_at desc limit 200` —
    // without this, that query must scan every row for the tenant and sort
    // in memory instead of walking an index in order (found in a real audit
    // of every "recent list" query's index coverage against its own ORDER
    // BY column, this session).
    index("card_feedback_org_created_at_index").on(
      table.organizationId,
      table.createdAt,
    ),
    check(
      "card_feedback_finding_id_not_blank",
      sql`length(btrim(${table.findingId})) > 0`,
    ),
    // Kept in sync with cardTypeSchema (@signaldesk/schemas), plus one
    // deliberate exception: 'stuck' was retired as a real CardType during
    // Phase 1's lead-risk/stuck-finding fusion (implementation roadmap),
    // but real historical card_feedback rows with card_type = 'stuck'
    // still exist (44 in the live dev project, confirmed before writing
    // this) — dropping it from this list would break a live CHECK
    // constraint against real, already-stored data, not just stop future
    // inserts. Kept here for read/historical compatibility only; no
    // current code path can ever insert 'stuck' again (it isn't a valid
    // CardType in TypeScript). 'ownership_gap'/'message_follow_up'/
    // 'ticket_risk' were added as real CardTypes after this constraint
    // was written and neither renders CardFeedbackButtons today, so this
    // was stale but not an active bug — fixed now rather than left as a
    // landmine for whichever of the three wires feedback in next.
    check(
      "card_feedback_card_type_allowed",
      sql`${table.cardType} in ('stuck', 'lead_risk', 'integration_health', 'ownership_gap', 'invoice_risk', 'task_risk', 'agent_recommendation', 'payment_received', 'goal_variance', 'message_follow_up', 'ticket_risk')`,
    ),
    check(
      "card_feedback_feedback_allowed",
      sql`${table.feedback} in ('useful', 'not_relevant')`,
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
    // Set only when actorKind = 'agent' (0034/Agent Fabric) — a static
    // in-code catalog id (AGENT_REGISTRY, @signaldesk/application), not a
    // FK: agent ids are code, not a database-owned table, same reasoning
    // as integrations.sourceSystem being text.
    actorAgentId: text("actor_agent_id"),
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
      sql`${table.actorKind} in ('user', 'system', 'integration', 'agent')`,
    ),
    // Three-way (0034, was a two-way user/non-user check): 'user' carries
    // actor_membership_id only, 'agent' carries actor_agent_id only,
    // 'system'/'integration' carry neither.
    check(
      "audit_events_actor_membership_consistent",
      sql`(${table.actorKind} = 'user' and ${table.actorMembershipId} is not null and ${table.actorAgentId} is null) or (${table.actorKind} = 'agent' and ${table.actorAgentId} is not null and ${table.actorMembershipId} is null) or (${table.actorKind} in ('system', 'integration') and ${table.actorMembershipId} is null and ${table.actorAgentId} is null)`,
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

// Goal Intelligence (Prompt 22, docs/product-vision-backlog.md, ADR 0035):
// a goal's own definition only — status/variance is never stored, computed
// live by @signaldesk/goals from the current @signaldesk/semantics metric
// value, the same "recomputed fresh each read" choice PrioritizedFinding
// and MetricValue already make. Append-only like card_feedback above (no
// update/delete policy): removing a stale goal is an explicitly disclosed
// gap in this first slice, not an oversight.
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ownerMembershipId: uuid("owner_membership_id").notNull(),
    // A static @signaldesk/semantics METRIC_CATALOG id, not a FK — same
    // "static in-code catalog id" precedent as auditEvents.actorAgentId.
    // The check constraint below still enforces a closed, known set; widen
    // it (a migration) the day a sixth real metric is added.
    metricId: text("metric_id").notNull(),
    name: text("name").notNull(),
    comparisonOperator: text("comparison_operator").notNull(),
    targetValue: bigint("target_value", { mode: "bigint" }).notNull(),
    // Only meaningful when the target metric's unit is "currency" — see
    // @signaldesk/goals' evaluateGoal doc comment for how this is matched
    // against a metric that produced more than one currency group.
    currency: text("currency"),
    idempotencyKey: text("idempotency_key").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("goals_org_id_id_unique").on(table.organizationId, table.id),
    unique("goals_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "goals_org_owner_membership_fk",
      columns: [table.organizationId, table.ownerMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("goals_org_metric_index").on(table.organizationId, table.metricId),
    // Covers goals_org_owner_membership_fk — flagged by Supabase's
    // performance advisor as an unindexed foreign key (frontend/backend
    // audit follow-up, 2026-08-21).
    index("goals_org_owner_membership_index").on(
      table.organizationId,
      table.ownerMembershipId,
    ),
    // Backs listGoals's `order by created_at desc limit 100` — without
    // this, the query must scan every goal for the tenant and sort in
    // memory instead of walking an index in order. Read on every
    // command-center page render and every Daily Brief generation, so
    // this is a real hot path.
    index("goals_org_created_at_index").on(
      table.organizationId,
      table.createdAt,
    ),
    check(
      "goals_metric_id_allowed",
      sql`${table.metricId} in ('accounts_receivable', 'overdue_receivable_exposure', 'pipeline_value', 'cash_collected_recent', 'open_task_backlog')`,
    ),
    check("goals_name_not_blank", sql`length(btrim(${table.name})) > 0`),
    check(
      "goals_comparison_operator_allowed",
      sql`${table.comparisonOperator} in ('at_most', 'at_least')`,
    ),
    check("goals_target_value_nonnegative", sql`${table.targetValue} >= 0`),
    check(
      "goals_currency_format",
      sql`${table.currency} is null or ${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "goals_idempotency_key_not_blank",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
  ],
);

// Agent Fabric (0034/ADR 0020): one row per "investigate risk" run.
// Deliberately NOT a lead-scoped row like signals/recommendations above —
// a collaboration reconciles findings across independent entities (real
// overdue invoices AND real overdue tasks), so it cannot honestly hang off
// one leadId/sourceRecordId the way those tables' hard FK requires.
export const agentCollaborations = pgTable(
  "agent_collaborations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    triggeredByMembershipId: uuid("triggered_by_membership_id").notNull(),
    // 'parallel_specialists' (the business-wide investigate sweep) or
    // 'single_specialist' (ADR 0056 — draft-message-reply-action.ts's
    // one-message, one-specialist collaboration). See AGENT_REGISTRY/
    // runParallelSpecialists/draftMessageReply, @signaldesk/application.
    pattern: text("pattern").notNull(),
    objective: text("objective").notNull(),
    status: text("status").notNull().default("running"),
    // Set only for a 'single_specialist' collaboration drafting content
    // about one real entity (ADR 0056 for messageId; ADR 0057 for the four
    // added alongside it) — exactly one of these five is non-null for a
    // 'single_specialist' row, all five are null for a 'parallel_specialists'
    // row (see the widened pattern-consistency check below). Deliberately
    // five narrow parallel columns, not one generic polymorphic
    // (entityKind, entityId) pair — each keeps a real, enforced FK to its
    // own parent table, which a generic pair could not.
    messageId: uuid("message_id"),
    invoiceId: uuid("invoice_id"),
    taskId: uuid("task_id"),
    leadId: uuid("lead_id"),
    supportTicketId: uuid("support_ticket_id"),
    draftedContentSubject: text("drafted_content_subject"),
    draftedContentBody: text("drafted_content_body"),
    reconciledSummary: text("reconciled_summary"),
    reconciledConfidenceBasisPoints: integer(
      "reconciled_confidence_basis_points",
    ),
    contradictionsDetected: boolean("contradictions_detected")
      .notNull()
      .default(false),
    correlationId: text("correlation_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    startedAt: timestamp("started_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    // A first real slice of Decision Intelligence (Prompt 16,
    // docs/product-vision-backlog.md, ADR 0027): whether a human approved
    // or dismissed this recommendation, and when — set by the same
    // Server Actions that already write the audit_events row for this
    // decision, so this is a queryable mirror of that outcome, not a
    // second source of truth for it.
    outcome: text("outcome"),
    reviewedAt: timestamp("reviewed_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("agent_collaborations_org_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("agent_collaborations_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "agent_collaborations_org_actor_membership_fk",
      columns: [table.organizationId, table.triggeredByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "agent_collaborations_org_message_fk",
      columns: [table.organizationId, table.messageId],
      foreignColumns: [messages.organizationId, messages.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "agent_collaborations_org_invoice_fk",
      columns: [table.organizationId, table.invoiceId],
      foreignColumns: [invoices.organizationId, invoices.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "agent_collaborations_org_task_fk",
      columns: [table.organizationId, table.taskId],
      foreignColumns: [tasks.organizationId, tasks.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "agent_collaborations_org_lead_fk",
      columns: [table.organizationId, table.leadId],
      foreignColumns: [leads.organizationId, leads.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "agent_collaborations_org_support_ticket_fk",
      columns: [table.organizationId, table.supportTicketId],
      foreignColumns: [supportTickets.organizationId, supportTickets.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("agent_collaborations_org_status_index").on(
      table.organizationId,
      table.status,
    ),
    // Backs listRecentAgentCollaborations's `order by started_at desc
    // limit 20` — without this, the query must scan every collaboration
    // for the tenant and sort in memory instead of walking an index in
    // order.
    index("agent_collaborations_org_started_at_index").on(
      table.organizationId,
      table.startedAt,
    ),
    // Covers agent_collaborations_org_actor_membership_fk — flagged by
    // Supabase's performance advisor as an unindexed foreign key
    // (frontend/backend audit follow-up, 2026-08-21).
    index("agent_collaborations_org_actor_membership_index").on(
      table.organizationId,
      table.triggeredByMembershipId,
    ),
    // Covers agent_collaborations_org_message_fk/_invoice_fk/_task_fk/
    // _lead_fk/_support_ticket_fk — same unindexed-foreign-key precedent as
    // the actor-membership index above.
    index("agent_collaborations_org_message_index").on(
      table.organizationId,
      table.messageId,
    ),
    index("agent_collaborations_org_invoice_index").on(
      table.organizationId,
      table.invoiceId,
    ),
    index("agent_collaborations_org_task_index").on(
      table.organizationId,
      table.taskId,
    ),
    index("agent_collaborations_org_lead_index").on(
      table.organizationId,
      table.leadId,
    ),
    index("agent_collaborations_org_support_ticket_index").on(
      table.organizationId,
      table.supportTicketId,
    ),
    check(
      "agent_collaborations_pattern_allowed",
      sql`${table.pattern} in ('parallel_specialists', 'single_specialist')`,
    ),
    // Widened from a single messageId/pattern equality (ADR 0056) to a
    // count across all five entity-id columns (ADR 0057): a
    // 'single_specialist' row must set EXACTLY ONE of them, a
    // 'parallel_specialists' row must set NONE. A naive
    // `(pattern = 'single_specialist') = (count <> 0)` would wrongly allow
    // 2+ ids set at once — this counts precisely instead.
    check(
      "agent_collaborations_entity_pattern_consistent",
      sql`(case when ${table.pattern} = 'single_specialist' then 1 else 0 end) =
          (case when ${table.messageId} is not null then 1 else 0 end +
           case when ${table.invoiceId} is not null then 1 else 0 end +
           case when ${table.taskId} is not null then 1 else 0 end +
           case when ${table.leadId} is not null then 1 else 0 end +
           case when ${table.supportTicketId} is not null then 1 else 0 end)`,
    ),
    check(
      "agent_collaborations_drafted_content_consistent",
      // Two real invariants, not one: (1) subject implies body, universally
      // — a subject with no body is never valid for any entity type; (2) a
      // message_id-linked (Gmail) collaboration with a real drafted body
      // must also have a subject — a real email needs one. Body-only is
      // still valid for every other entity type (Asana/HubSpot/Zendesk
      // comment or note never has a subject at all).
      //
      // Real gap found by review: this constraint used to be only
      // invariant (1) — loosened from the old Gmail-only strict equality
      // check to accommodate the other four entity types' body-only
      // drafts, but that loosening applied uniformly, so a message_id-
      // linked collaboration could be marked 'completed' with a real body
      // and a null subject without this constraint ever catching it
      // (customer_email_replies' own subject_not_blank check would still
      // have caught it before an actual send, but not at draft-completion
      // time, where this constraint is meant to catch it).
      sql`(${table.draftedContentSubject} is null or ${table.draftedContentBody} is not null)
          and (${table.messageId} is null or ${table.draftedContentBody} is null or ${table.draftedContentSubject} is not null)`,
    ),
    check(
      "agent_collaborations_status_allowed",
      sql`${table.status} in ('running', 'completed', 'failed')`,
    ),
    check(
      "agent_collaborations_objective_not_blank",
      sql`length(btrim(${table.objective})) > 0`,
    ),
    check(
      "agent_collaborations_idempotency_key_not_blank",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    check(
      "agent_collaborations_confidence_range",
      sql`${table.reconciledConfidenceBasisPoints} is null or (${table.reconciledConfidenceBasisPoints} >= 0 and ${table.reconciledConfidenceBasisPoints} <= 10000)`,
    ),
    check(
      "agent_collaborations_completion_consistent",
      sql`(${table.status} = 'running' and ${table.completedAt} is null) or (${table.status} in ('completed', 'failed') and ${table.completedAt} is not null)`,
    ),
    check(
      "agent_collaborations_outcome_allowed",
      sql`${table.outcome} is null or ${table.outcome} in ('approved', 'dismissed')`,
    ),
    check(
      "agent_collaborations_outcome_reviewed_consistent",
      sql`(${table.outcome} is null and ${table.reviewedAt} is null) or (${table.outcome} is not null and ${table.reviewedAt} is not null)`,
    ),
  ],
);

// One row per specialist call within a collaboration — the real, durable
// evidence behind "two backends genuinely ran in parallel" (agentId
// distinguishes claude-specialist from deterministic-specialist).
export const agentTaskResults = pgTable(
  "agent_task_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    collaborationId: uuid("collaboration_id").notNull(),
    // Static AGENT_REGISTRY catalog id, not a FK — see auditEvents.actorAgentId.
    agentId: text("agent_id").notNull(),
    capability: text("capability").notNull(),
    status: text("status").notNull(),
    claims: jsonb("claims").notNull(),
    evidenceIds: jsonb("evidence_ids").notNull(),
    confidenceBasisPoints: integer("confidence_basis_points"),
    // Set only for a "draft_*" capability's result (ADR 0056, ADR 0057) —
    // the structured {subject?, body} a human reviews before approving the
    // send/post. Null for every other capability's result.
    draftedContent: jsonb("drafted_content"),
    startedAt: timestamp("started_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    unique("agent_task_results_org_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      name: "agent_task_results_org_collaboration_fk",
      columns: [table.organizationId, table.collaborationId],
      foreignColumns: [
        agentCollaborations.organizationId,
        agentCollaborations.id,
      ],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("agent_task_results_org_collaboration_index").on(
      table.organizationId,
      table.collaborationId,
    ),
    check(
      "agent_task_results_status_allowed",
      sql`${table.status} in ('completed', 'abstained', 'failed')`,
    ),
    check(
      "agent_task_results_agent_id_not_blank",
      sql`length(btrim(${table.agentId})) > 0`,
    ),
    check(
      "agent_task_results_confidence_range",
      sql`${table.confidenceBasisPoints} is null or (${table.confidenceBasisPoints} >= 0 and ${table.confidenceBasisPoints} <= 10000)`,
    ),
  ],
);

// One row per capability grant minted for a specialist call — the real
// session boundary (expiresAt) AgentGatewayService enforces before ever
// calling a provider. Deliberately not reused across tasks: a fresh grant
// per dispatch keeps the attenuation chain auditable one hop at a time.
export const agentDelegationGrants = pgTable(
  "agent_delegation_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    collaborationId: uuid("collaboration_id").notNull(),
    agentId: text("agent_id").notNull(),
    capability: text("capability").notNull(),
    canPropose: boolean("can_propose").notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("agent_delegation_grants_org_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    foreignKey({
      name: "agent_delegation_grants_org_collaboration_fk",
      columns: [table.organizationId, table.collaborationId],
      foreignColumns: [
        agentCollaborations.organizationId,
        agentCollaborations.id,
      ],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("agent_delegation_grants_org_collaboration_index").on(
      table.organizationId,
      table.collaborationId,
    ),
    // Backs listRecentAgentDelegationGrants's `order by created_at desc
    // limit 25` — without this, the query must scan every grant for the
    // tenant and sort in memory instead of walking an index in order.
    index("agent_delegation_grants_org_created_at_index").on(
      table.organizationId,
      table.createdAt,
    ),
    check(
      "agent_delegation_grants_agent_id_not_blank",
      sql`length(btrim(${table.agentId})) > 0`,
    ),
    check(
      "agent_delegation_grants_expiry_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

// The Safe Action pattern's second real write path (ADR 0056), alongside
// internal_tasks — but this one's real side effect happens outside this
// database, so status is a durable lifecycle ('pending' -> 'sent'/'failed')
// rather than internal_tasks' single insert-and-done. A row starts
// 'pending' the moment the Gmail API call is made and is only updated to
// 'sent'/'failed' after that call returns — if the process crashes in
// between, the row is left 'pending' with no way to know whether the send
// actually went out (disclosed limitation: beginCustomerEmailReplySend,
// @signaldesk/persistence, treats a pre-existing 'pending' row as unsafe to
// auto-retry, not a bug to silently paper over).
export const customerEmailReplies = pgTable(
  "customer_email_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentCollaborationId: uuid("agent_collaboration_id").notNull(),
    messageId: uuid("message_id").notNull(),
    triggeredByMembershipId: uuid("triggered_by_membership_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("pending"),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    gmailMessageId: text("gmail_message_id"),
    gmailThreadId: text("gmail_thread_id"),
    failureReason: text("failure_reason"),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("customer_email_replies_org_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("customer_email_replies_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "customer_email_replies_org_collaboration_fk",
      columns: [table.organizationId, table.agentCollaborationId],
      foreignColumns: [
        agentCollaborations.organizationId,
        agentCollaborations.id,
      ],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "customer_email_replies_org_message_fk",
      columns: [table.organizationId, table.messageId],
      foreignColumns: [messages.organizationId, messages.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "customer_email_replies_org_membership_fk",
      columns: [table.organizationId, table.triggeredByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("customer_email_replies_org_collaboration_index").on(
      table.organizationId,
      table.agentCollaborationId,
    ),
    index("customer_email_replies_org_message_index").on(
      table.organizationId,
      table.messageId,
    ),
    index("customer_email_replies_org_membership_index").on(
      table.organizationId,
      table.triggeredByMembershipId,
    ),
    check(
      "customer_email_replies_status_allowed",
      sql`${table.status} in ('pending', 'sent', 'failed')`,
    ),
    check(
      "customer_email_replies_idempotency_key_not_blank",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    check(
      "customer_email_replies_to_email_not_blank",
      sql`length(btrim(${table.toEmail})) > 0`,
    ),
    check(
      "customer_email_replies_subject_not_blank",
      sql`length(btrim(${table.subject})) > 0`,
    ),
    check(
      "customer_email_replies_body_not_blank",
      sql`length(btrim(${table.body})) > 0`,
    ),
    check(
      "customer_email_replies_sent_consistent",
      sql`(${table.status} = 'sent' and ${table.gmailMessageId} is not null and ${table.gmailThreadId} is not null and ${table.sentAt} is not null) or (${table.status} != 'sent')`,
    ),
    check(
      "customer_email_replies_failed_consistent",
      sql`(${table.status} = 'failed' and ${table.failureReason} is not null) or (${table.status} != 'failed')`,
    ),
  ],
);

// The Safe Action pattern's third real write path (ADR 0057), same shape
// as customer_email_replies: a durable pending/sent/failed lifecycle for a
// write whose real side effect happens outside this database. No toEmail
// column — QuickBooks emails the invoice's own on-file customer, this app
// never needs to know it. No external message id column: QuickBooks'
// invoice/send endpoint returns no distinct, storable message identifier
// to record as send evidence (unlike Gmail's message/thread id) — status +
// sentAt is the real, honest evidence kept here.
export const quickbooksInvoiceReminders = pgTable(
  "quickbooks_invoice_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentCollaborationId: uuid("agent_collaboration_id").notNull(),
    invoiceId: uuid("invoice_id").notNull(),
    triggeredByMembershipId: uuid("triggered_by_membership_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("pending"),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    failureReason: text("failure_reason"),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("quickbooks_invoice_reminders_org_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("quickbooks_invoice_reminders_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "quickbooks_invoice_reminders_org_collaboration_fk",
      columns: [table.organizationId, table.agentCollaborationId],
      foreignColumns: [
        agentCollaborations.organizationId,
        agentCollaborations.id,
      ],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "quickbooks_invoice_reminders_org_invoice_fk",
      columns: [table.organizationId, table.invoiceId],
      foreignColumns: [invoices.organizationId, invoices.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "quickbooks_invoice_reminders_org_membership_fk",
      columns: [table.organizationId, table.triggeredByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("quickbooks_invoice_reminders_org_collaboration_index").on(
      table.organizationId,
      table.agentCollaborationId,
    ),
    index("quickbooks_invoice_reminders_org_invoice_index").on(
      table.organizationId,
      table.invoiceId,
    ),
    index("quickbooks_invoice_reminders_org_membership_index").on(
      table.organizationId,
      table.triggeredByMembershipId,
    ),
    check(
      "quickbooks_invoice_reminders_status_allowed",
      sql`${table.status} in ('pending', 'sent', 'failed')`,
    ),
    check(
      "quickbooks_invoice_reminders_idempotency_key_not_blank",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    check(
      "quickbooks_invoice_reminders_subject_not_blank",
      sql`length(btrim(${table.subject})) > 0`,
    ),
    check(
      "quickbooks_invoice_reminders_body_not_blank",
      sql`length(btrim(${table.body})) > 0`,
    ),
    check(
      "quickbooks_invoice_reminders_sent_consistent",
      sql`(${table.status} = 'sent' and ${table.sentAt} is not null) or (${table.status} != 'sent')`,
    ),
    check(
      "quickbooks_invoice_reminders_failed_consistent",
      sql`(${table.status} = 'failed' and ${table.failureReason} is not null) or (${table.status} != 'failed')`,
    ),
  ],
);

// Same shape as quickbooksInvoiceReminders (ADR 0057) — a nudge comment
// posted on an overdue Asana task. Body-only (no subject: an Asana story
// is a plain comment, not an email). asanaStoryGid is the real send
// evidence: Asana's story-creation response returns a distinct gid,
// stored here once the post succeeds.
export const asanaTaskNudges = pgTable(
  "asana_task_nudges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentCollaborationId: uuid("agent_collaboration_id").notNull(),
    taskId: uuid("task_id").notNull(),
    triggeredByMembershipId: uuid("triggered_by_membership_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("pending"),
    body: text("body").notNull(),
    asanaStoryGid: text("asana_story_gid"),
    failureReason: text("failure_reason"),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("asana_task_nudges_org_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("asana_task_nudges_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "asana_task_nudges_org_collaboration_fk",
      columns: [table.organizationId, table.agentCollaborationId],
      foreignColumns: [
        agentCollaborations.organizationId,
        agentCollaborations.id,
      ],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "asana_task_nudges_org_task_fk",
      columns: [table.organizationId, table.taskId],
      foreignColumns: [tasks.organizationId, tasks.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "asana_task_nudges_org_membership_fk",
      columns: [table.organizationId, table.triggeredByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("asana_task_nudges_org_collaboration_index").on(
      table.organizationId,
      table.agentCollaborationId,
    ),
    index("asana_task_nudges_org_task_index").on(
      table.organizationId,
      table.taskId,
    ),
    index("asana_task_nudges_org_membership_index").on(
      table.organizationId,
      table.triggeredByMembershipId,
    ),
    check(
      "asana_task_nudges_status_allowed",
      sql`${table.status} in ('pending', 'sent', 'failed')`,
    ),
    check(
      "asana_task_nudges_idempotency_key_not_blank",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    check(
      "asana_task_nudges_body_not_blank",
      sql`length(btrim(${table.body})) > 0`,
    ),
    check(
      "asana_task_nudges_sent_consistent",
      sql`(${table.status} = 'sent' and ${table.asanaStoryGid} is not null and ${table.sentAt} is not null) or (${table.status} != 'sent')`,
    ),
    check(
      "asana_task_nudges_failed_consistent",
      sql`(${table.status} = 'failed' and ${table.failureReason} is not null) or (${table.status} != 'failed')`,
    ),
  ],
);

// Same shape again (ADR 0057) — a note logged on a stalled HubSpot deal.
// Body-only. hubspotNoteId is the real send evidence: HubSpot's note-create
// response returns a distinct id, stored here once the post succeeds.
export const hubspotDealNotes = pgTable(
  "hubspot_deal_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentCollaborationId: uuid("agent_collaboration_id").notNull(),
    leadId: uuid("lead_id").notNull(),
    triggeredByMembershipId: uuid("triggered_by_membership_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("pending"),
    body: text("body").notNull(),
    hubspotNoteId: text("hubspot_note_id"),
    failureReason: text("failure_reason"),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("hubspot_deal_notes_org_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("hubspot_deal_notes_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "hubspot_deal_notes_org_collaboration_fk",
      columns: [table.organizationId, table.agentCollaborationId],
      foreignColumns: [
        agentCollaborations.organizationId,
        agentCollaborations.id,
      ],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "hubspot_deal_notes_org_lead_fk",
      columns: [table.organizationId, table.leadId],
      foreignColumns: [leads.organizationId, leads.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "hubspot_deal_notes_org_membership_fk",
      columns: [table.organizationId, table.triggeredByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("hubspot_deal_notes_org_collaboration_index").on(
      table.organizationId,
      table.agentCollaborationId,
    ),
    index("hubspot_deal_notes_org_lead_index").on(
      table.organizationId,
      table.leadId,
    ),
    index("hubspot_deal_notes_org_membership_index").on(
      table.organizationId,
      table.triggeredByMembershipId,
    ),
    check(
      "hubspot_deal_notes_status_allowed",
      sql`${table.status} in ('pending', 'sent', 'failed')`,
    ),
    check(
      "hubspot_deal_notes_idempotency_key_not_blank",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    check(
      "hubspot_deal_notes_body_not_blank",
      sql`length(btrim(${table.body})) > 0`,
    ),
    check(
      "hubspot_deal_notes_sent_consistent",
      sql`(${table.status} = 'sent' and ${table.hubspotNoteId} is not null and ${table.sentAt} is not null) or (${table.status} != 'sent')`,
    ),
    check(
      "hubspot_deal_notes_failed_consistent",
      sql`(${table.status} = 'failed' and ${table.failureReason} is not null) or (${table.status} != 'failed')`,
    ),
  ],
);

// Same shape again (ADR 0057) — a reply comment posted on a stuck Zendesk
// ticket. Body-only. No external comment-id column: Zendesk's ticket-update
// response does not reliably return a distinct, storable comment
// identifier separate from the ticket itself (verify during this
// connector's build slice) — status + sentAt is the honest evidence kept
// here, matching quickbooksInvoiceReminders' same disclosed limitation.
export const zendeskTicketReplies = pgTable(
  "zendesk_ticket_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentCollaborationId: uuid("agent_collaboration_id").notNull(),
    supportTicketId: uuid("support_ticket_id").notNull(),
    triggeredByMembershipId: uuid("triggered_by_membership_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("pending"),
    body: text("body").notNull(),
    failureReason: text("failure_reason"),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("zendesk_ticket_replies_org_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("zendesk_ticket_replies_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    foreignKey({
      name: "zendesk_ticket_replies_org_collaboration_fk",
      columns: [table.organizationId, table.agentCollaborationId],
      foreignColumns: [
        agentCollaborations.organizationId,
        agentCollaborations.id,
      ],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "zendesk_ticket_replies_org_support_ticket_fk",
      columns: [table.organizationId, table.supportTicketId],
      foreignColumns: [supportTickets.organizationId, supportTickets.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    foreignKey({
      name: "zendesk_ticket_replies_org_membership_fk",
      columns: [table.organizationId, table.triggeredByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("zendesk_ticket_replies_org_collaboration_index").on(
      table.organizationId,
      table.agentCollaborationId,
    ),
    index("zendesk_ticket_replies_org_support_ticket_index").on(
      table.organizationId,
      table.supportTicketId,
    ),
    index("zendesk_ticket_replies_org_membership_index").on(
      table.organizationId,
      table.triggeredByMembershipId,
    ),
    check(
      "zendesk_ticket_replies_status_allowed",
      sql`${table.status} in ('pending', 'sent', 'failed')`,
    ),
    check(
      "zendesk_ticket_replies_idempotency_key_not_blank",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    check(
      "zendesk_ticket_replies_body_not_blank",
      sql`length(btrim(${table.body})) > 0`,
    ),
    check(
      "zendesk_ticket_replies_sent_consistent",
      sql`(${table.status} = 'sent' and ${table.sentAt} is not null) or (${table.status} != 'sent')`,
    ),
    check(
      "zendesk_ticket_replies_failed_consistent",
      sql`(${table.status} = 'failed' and ${table.failureReason} is not null) or (${table.status} != 'failed')`,
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
    // The real Stripe event `created` timestamp of whichever webhook last
    // actually wrote this row's Stripe-mirrored fields — `null` until the
    // first webhook for this subscription lands. `updateSubscriptionFromStripe`
    // (packages/persistence/src/subscriptions.ts) uses this to reject an
    // out-of-order webhook retry (Stripe does not guarantee delivery
    // order) rather than let a stale event silently regress state a newer
    // one already superseded. Direct, synchronous callers (cancel/resume/
    // change-plan Server Actions, the reconciliation cron's own fresh
    // Stripe read) have no event to compare and don't touch this guard at
    // all.
    stripeEventSyncedAt: timestamp("stripe_event_synced_at", {
      mode: "date",
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    unique("organization_subscriptions_org_unique").on(table.organizationId),
    // Real constraints, not just indexes (found by review): the webhook
    // handler resolves an organization from a bare `where
    // stripe_subscription_id = $1` / `where stripe_customer_id = $1`
    // (`resolve_organization_for_stripe_subscription`/`_customer`,
    // 0025_resolve_organization_for_stripe_id.sql) with nothing at the DB
    // layer stopping two different organizations from ever ending up
    // with the same Stripe id — which would let a real Stripe event for
    // one tenant silently apply to whichever organization Postgres
    // happens to return first. Multiple `NULL`s (a subscription never
    // linked to Stripe) remain allowed — Postgres unique constraints
    // never compare `NULL` to `NULL` as equal, so this only rejects a
    // genuine duplicate non-null id.
    unique("organization_subscriptions_stripe_subscription_id_unique").on(
      table.stripeSubscriptionId,
    ),
    unique("organization_subscriptions_stripe_customer_id_unique").on(
      table.stripeCustomerId,
    ),
    // Cover organization_subscriptions_plan_id_fkey/_plan_price_id_fkey —
    // flagged by Supabase's performance advisor as unindexed foreign
    // keys (frontend/backend audit follow-up, 2026-08-21).
    index("organization_subscriptions_plan_id_index").on(table.planId),
    index("organization_subscriptions_plan_price_id_index").on(
      table.planPriceId,
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
    // Covers organization_subscription_addons_plan_addon_id_fkey —
    // flagged by Supabase's performance advisor as an unindexed foreign
    // key (frontend/backend audit follow-up, 2026-08-21). The addons'
    // own subscription_id FK is already covered as a leftmost prefix of
    // the composite unique constraint above.
    index("organization_subscription_addons_plan_addon_id_index").on(
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

/**
 * Real, shared, cross-instance rate-limit state — replaces the in-memory
 * `Map` in `apps/web/app/_lib/rate-limit.ts`, which is documented there as
 * single-process-only and silently stops protecting against abuse the
 * moment this app runs as more than one server instance. Deliberately NOT
 * a tenant table (no RLS, no `organizationId`): a rate-limit key is
 * sometimes IP-based and pre-authentication (sign-in, sign-up, guest
 * access — `apps/web/app/_actions/auth.ts`, before any tenant context can
 * exist at all), sometimes organization-scoped by convention of the key
 * string itself (e.g. `start-checkout:${organizationId}`) — RLS's
 * per-tenant model doesn't apply to a key namespace that isn't itself
 * tenant data. No business information is ever stored here, only a count
 * and a window start per opaque string key.
 */
export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  windowStart: timestamp("window_start", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Real multi-member invites (Phase 3 of the implementation roadmap) — the
 * prerequisite for the existing `owner|admin|member|viewer` RBAC enum on
 * `memberships` to mean anything (every real org has exactly one member
 * today). Keyed by email, not a `users.id` FK, since an invitee usually
 * doesn't have an account yet — `token` is validated pre-auth by a
 * SECURITY DEFINER function (mirroring `identity_provisioner`'s existing
 * pre-tenant-context pattern, drizzle/0007), never by ordinary
 * tenant-scoped RLS, since there is no tenant context to scope by until
 * after acceptance creates the real membership. `role` excludes `owner`
 * deliberately — an invite can never mint a second owner.
 */
export const organizationInvites = pgTable(
  "organization_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invitedByMembershipId: uuid("invited_by_membership_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    token: text("token").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    acceptedAt: timestamp("accepted_at", {
      mode: "date",
      withTimezone: true,
    }),
    ...timestamps,
  },
  (table) => [
    unique("organization_invites_org_id_id_unique").on(
      table.organizationId,
      table.id,
    ),
    unique("organization_invites_token_unique").on(table.token),
    foreignKey({
      name: "organization_invites_org_invited_by_fk",
      columns: [table.organizationId, table.invitedByMembershipId],
      foreignColumns: [memberships.organizationId, memberships.id],
    })
      .onUpdate("restrict")
      .onDelete("restrict"),
    index("organization_invites_org_status_index").on(
      table.organizationId,
      table.status,
    ),
    // Covers organization_invites_org_invited_by_fk — flagged by
    // Supabase's performance advisor as an unindexed foreign key
    // (frontend/backend audit follow-up, 2026-08-21).
    index("organization_invites_org_invited_by_index").on(
      table.organizationId,
      table.invitedByMembershipId,
    ),
    check(
      "organization_invites_role_allowed",
      sql`${table.role} in ('admin', 'member', 'viewer')`,
    ),
    check(
      "organization_invites_status_allowed",
      sql`${table.status} in ('pending', 'accepted', 'revoked', 'expired')`,
    ),
    check(
      "organization_invites_email_not_blank",
      sql`length(btrim(${table.email})) > 0`,
    ),
    check(
      "organization_invites_token_not_blank",
      sql`length(btrim(${table.token})) > 0`,
    ),
    check(
      "organization_invites_acceptance_state_consistent",
      sql`(${table.status} = 'accepted' and ${table.acceptedAt} is not null) or (${table.status} != 'accepted' and ${table.acceptedAt} is null)`,
    ),
  ],
);

// A real, per-organization AI provider API key (Phase 4c, implementation
// roadmap) — deliberately its own table, not shoehorned into
// `integrations`: that table requires an `externalAccountId`/OAuth-shaped
// row an arbitrary API key doesn't have, and reusing its token functions
// would mean storing a bare key in a column literally named
// `access_token`. `providerFor` (apps/web/app/_lib/agent-fabric.ts) reads
// this to fund the Agent Fabric's already-existing, already-approval-
// gated `interpret_findings` calls with the org's own key instead of the
// platform-wide `ANTHROPIC_API_KEY` — this table grants zero new
// action-execution capability; `canExecute` stays `z.literal(false)`
// everywhere, untouched.
export const aiProviderConnections = pgTable(
  "ai_provider_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Real, narrow, and honest: only "anthropic" is a real
    // `AIProvider` implementation today (`createClaudeProvider`,
    // @signaldesk/application) — this is not a fake enum pretending
    // OpenAI/Gemini adapters exist yet.
    provider: text("provider").notNull(),
    // Mirrors `integrations.tokenVaultSecretId`'s exact pattern — the
    // real API key lives only in Supabase Vault, never in this column or
    // anywhere else in this database.
    vaultSecretId: uuid("vault_secret_id"),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    unique("ai_provider_connections_org_provider_unique").on(
      table.organizationId,
      table.provider,
    ),
    check(
      "ai_provider_connections_provider_allowed",
      sql`${table.provider} in ('anthropic')`,
    ),
  ],
);
