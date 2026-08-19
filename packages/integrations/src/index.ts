import { ASANA_SCOPES } from "./asana/client";
import { GMAIL_SCOPES } from "./gmail/client";
import { GOOGLE_CALENDAR_SCOPES } from "./google-calendar/client";
import { HUBSPOT_SCOPES } from "./hubspot/client";
import { LINEAR_SCOPES } from "./linear/client";
import { MICROSOFT_CALENDAR_SCOPES } from "./microsoft-calendar/client";
import { MICROSOFT_OUTLOOK_SCOPES } from "./microsoft-outlook/client";
import { QUICKBOOKS_SCOPES } from "./quickbooks/client";
import { SLACK_SCOPES } from "./slack/client";
import { STRIPE_SCOPE } from "./stripe/client";

export const connectorCategories = [
  "communication",
  "crm",
  "email",
  "payments",
  "accounting",
  "calendar",
  "project-management",
] as const;

export type ConnectorCategory = (typeof connectorCategories)[number];

/**
 * "Where does this live in your business?" — the onboarding-facing framing
 * the mega-spec asked Integration Hub to organize around, instead of
 * technical category/logo count. Deliberately limited to purposes a real
 * connector actually fills today (`category` already covers 7; this is a
 * business-framing relabeling of the same 10 connectors, not a new,
 * broader taxonomy with empty slots) — `support`/`contracts`/`documents`/
 * `marketing`/`commerce`/`people`/`engineering`/`identity`/`analytics`
 * from the mega-spec's fuller list stay unadded until a real connector
 * exists for one, matching this catalog's existing "no roadmap connector
 * marked as implemented" discipline.
 */
export const connectorPurposes = [
  "pipeline",
  "communication",
  "delivery",
  "calendar",
  "finance",
  "payments",
] as const;

export type ConnectorPurpose = (typeof connectorPurposes)[number];

export const connectorAvailabilities = [
  "foundation-preview",
  "planned",
] as const;

export type ConnectorAvailability = (typeof connectorAvailabilities)[number];

export type ConnectorDirection = "inbound" | "outbound" | "bidirectional";

export type ConnectorAccessPosture = "read-only" | "read-write";

export type ConnectorOperation = "read" | "write";

export type ConnectorAuthKind = "oauth2";

export type ConnectorImplementationGateId =
  | "adapter"
  | "authorization"
  | "tenant-isolation"
  | "security-review"
  | "observability"
  | "production-validation"
  | "write-action-safety";

export interface ConnectorCapability {
  /** A product-level capability identifier, never a provider OAuth scope. */
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly operation: ConnectorOperation;
}

export interface ConnectorAuthStrategy {
  readonly kind: ConnectorAuthKind;
  readonly label: string;
  /**
   * "not-configured": no integration code exists. "code-ready": the OAuth
   * flow and token storage are real and tested, but no real provider app
   * credentials have been supplied yet (the same gap ADR 0007 documents for
   * social sign-in) — this is not yet "configured".
   */
  readonly configuration: "not-configured" | "code-ready" | "configured";
  readonly scopesDefined: boolean;
  /** Real OAuth scope strings, only once scopesDefined is true. */
  readonly scopes?: readonly string[];
}

export interface ConnectorReadiness {
  /** The product catalog entry is the only implemented connector foundation. */
  readonly catalogMetadata: true;
  readonly adapterImplemented: boolean;
  readonly authorizationImplemented: boolean;
  /** Recurring/background sync — not yet true for any connector; see
   * `initialSyncImplemented` for the narrower, already-real distinction. */
  readonly syncImplemented: boolean;
  /** A real one-time sync-on-connect into the Business Graph (HubSpot
   * deals→leads, QuickBooks invoices, Asana tasks) — previously only
   * documented as prose ("only 'invoice' has a real mapper today") on
   * three connectors' entries below; now a typed, checkable fact so
   * callers (e.g. connector health summaries) don't have to duplicate
   * that knowledge as a hardcoded list. */
  readonly initialSyncImplemented: boolean;
  readonly actionsImplemented: boolean;
  /** Never auto-derived — requires an explicit, separate sign-off. */
  readonly productionReady: false;
}

export interface ConnectorImplementationGate {
  readonly id: ConnectorImplementationGateId;
  readonly label: string;
  readonly status: "required";
}

/**
 * Canonical Business Graph entity kinds a connector is designed to produce
 * — design intent, matching how `capabilities` already documents intended
 * behavior regardless of implementation status (see the Integration
 * Hub's "Designed behavior... not claims of live provider access" copy).
 * Only HubSpot's `["lead"]` is backed by a real mapper today; every other
 * connector's list is still honest design intent, not a live claim.
 */
export type SupportedEntityType =
  | "lead"
  | "contact"
  | "company"
  | "message"
  | "email"
  | "calendar_event"
  | "task"
  | "invoice"
  | "payment";

/**
 * Design-intent data-sensitivity classification, not a runtime data-flow
 * audit — a connector with zero live data flow (nine of ten today) still
 * has a defensible answer for "if this were connected, what kind of data
 * would it carry," which is what privacy/redaction decisions need.
 */
export interface ConnectorDataSensitivity {
  readonly containsPII: boolean;
  readonly containsFinancialData: boolean;
  readonly containsCustomerData: boolean;
}

/**
 * Every catalog connector today is first-party (built and maintained in
 * this repo). No customer-managed, generic-webhook, or MCP-remote
 * connector exists yet — this field exists so that distinction is a type,
 * not an assumption, the day one of those does.
 */
export type ConnectorTrustClassification = "first_party";

export interface ConnectorDefinition {
  readonly slug: ConnectorSlug;
  readonly name: string;
  readonly shortDescription: string;
  readonly category: ConnectorCategory;
  readonly purpose: ConnectorPurpose;
  /** Marketplace visibility only; neither value means a live connector exists. */
  readonly availability: ConnectorAvailability;
  readonly capabilities: readonly ConnectorCapability[];
  readonly authStrategy: ConnectorAuthStrategy;
  /** Intended data flow once implementation gates are completed. */
  readonly direction: ConnectorDirection;
  /** Intended product posture, not currently granted provider access. */
  readonly accessPosture: ConnectorAccessPosture;
  readonly readiness: ConnectorReadiness;
  readonly implementationGates: readonly ConnectorImplementationGate[];
  readonly supportedEntityTypes: readonly SupportedEntityType[];
  readonly dataSensitivity: ConnectorDataSensitivity;
  readonly trustClassification: ConnectorTrustClassification;
}

const requiredImplementationGates = [
  { id: "adapter", label: "Provider adapter", status: "required" },
  { id: "authorization", label: "Authorization flow", status: "required" },
  {
    id: "tenant-isolation",
    label: "Tenant isolation review",
    status: "required",
  },
  { id: "security-review", label: "Security review", status: "required" },
  { id: "observability", label: "Sync observability", status: "required" },
  {
    id: "production-validation",
    label: "Production validation",
    status: "required",
  },
] as const satisfies readonly ConnectorImplementationGate[];

const writeActionSafetyGate = {
  id: "write-action-safety",
  label: "Write-action safety review",
  status: "required",
} as const satisfies ConnectorImplementationGate;

const notImplementedReadiness: ConnectorReadiness = {
  catalogMetadata: true,
  adapterImplemented: false,
  authorizationImplemented: false,
  syncImplemented: false,
  initialSyncImplemented: false,
  actionsImplemented: false,
  productionReady: false,
};

const plannedOAuth2: ConnectorAuthStrategy = {
  kind: "oauth2",
  label: "OAuth 2.0 (planned)",
  configuration: "not-configured",
  scopesDefined: false,
};

function gatesFor(
  accessPosture: ConnectorAccessPosture,
): readonly ConnectorImplementationGate[] {
  return accessPosture === "read-write"
    ? [...requiredImplementationGates, writeActionSafetyGate]
    : requiredImplementationGates;
}

function defineConnector(
  definition: Omit<
    ConnectorDefinition,
    "authStrategy" | "readiness" | "implementationGates"
  > & {
    readonly authStrategy?: ConnectorAuthStrategy;
    readonly readiness?: ConnectorReadiness;
  },
): ConnectorDefinition {
  const { authStrategy, readiness, ...rest } = definition;

  return {
    ...rest,
    authStrategy: authStrategy ?? plannedOAuth2,
    readiness: readiness ?? notImplementedReadiness,
    implementationGates: gatesFor(definition.accessPosture),
  };
}

export const connectorCatalog = [
  defineConnector({
    slug: "slack",
    name: "Slack",
    shortDescription:
      "Bring team conversations and operational alerts into the command center.",
    category: "communication",
    purpose: "communication",
    availability: "foundation-preview",
    direction: "bidirectional",
    accessPosture: "read-write",
    capabilities: [
      {
        id: "team-conversation-insights",
        label: "Team conversation insights",
        description:
          "Summarize relevant team conversations and surface operational context.",
        operation: "read",
      },
      {
        id: "team-notification-actions",
        label: "Team notification actions",
        description:
          "Prepare governed notifications for an approved team destination.",
        operation: "write",
      },
    ],
    // OAuth flow and Vault-backed token storage are real and tested,
    // mirroring HubSpot's own connector (ADR 0008); sync and actions are
    // not built yet, and no real Slack app credentials exist yet.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0",
      configuration: "code-ready",
      scopesDefined: true,
      // Sourced from the real client, not re-typed here — see the same
      // rationale on HubSpot's entry below.
      scopes: SLACK_SCOPES,
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: false,
      actionsImplemented: false,
      productionReady: false,
    },
    supportedEntityTypes: ["message"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: false,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "hubspot",
    name: "HubSpot",
    shortDescription:
      "Surface customer, deal, and relationship activity from the CRM.",
    category: "crm",
    purpose: "pipeline",
    availability: "foundation-preview",
    direction: "bidirectional",
    accessPosture: "read-write",
    capabilities: [
      {
        id: "crm-record-insights",
        label: "CRM record insights",
        description:
          "Read customer and deal records for deterministic operational signals.",
        operation: "read",
      },
      {
        id: "crm-record-actions",
        label: "CRM record actions",
        description: "Prepare governed record updates after explicit approval.",
        operation: "write",
      },
    ],
    // See ADR 0008: HubSpot's first-real-connector status. OAuth flow and
    // Vault-backed token storage are real and tested; sync and actions are
    // not built yet, and no real HubSpot app credentials exist yet.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0",
      configuration: "code-ready",
      scopesDefined: true,
      // Sourced from the real client, not re-typed here — the client's
      // HUBSPOT_SCOPES is what's actually sent to HubSpot's authorize URL;
      // a hand-typed duplicate here could silently drift from it.
      scopes: HUBSPOT_SCOPES,
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: true,
      actionsImplemented: false,
      productionReady: false,
    },
    // "contact"/"company" are design intent (the CRM-record-insights
    // capability above); only "lead" has a real mapper today
    // (packages/integrations/src/hubspot/mapper.ts).
    supportedEntityTypes: ["lead", "contact", "company"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: true,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "gmail",
    name: "Gmail",
    shortDescription:
      "Connect business email context to customer and delivery workflows.",
    category: "email",
    purpose: "communication",
    availability: "foundation-preview",
    direction: "bidirectional",
    accessPosture: "read-write",
    capabilities: [
      {
        id: "email-thread-insights",
        label: "Email thread insights",
        description:
          "Read relevant message threads for follow-up and relationship context.",
        operation: "read",
      },
      {
        id: "email-draft-actions",
        label: "Email draft actions",
        description: "Prepare drafts for explicit human review and approval.",
        operation: "write",
      },
    ],
    // OAuth flow and Vault-backed token storage are real and tested,
    // sharing packages/integrations/src/shared/google-oauth.ts with
    // Google Calendar. Sync and actions are not built yet, and no real
    // Google Cloud OAuth client credentials exist yet.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0",
      configuration: "code-ready",
      scopesDefined: true,
      scopes: GMAIL_SCOPES,
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: false,
      actionsImplemented: false,
      productionReady: false,
    },
    supportedEntityTypes: ["email", "message", "contact"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "microsoft-outlook",
    name: "Microsoft Outlook",
    shortDescription:
      "Connect Microsoft business email context to operating workflows.",
    category: "email",
    purpose: "communication",
    availability: "foundation-preview",
    direction: "bidirectional",
    accessPosture: "read-write",
    capabilities: [
      {
        id: "email-thread-insights",
        label: "Email thread insights",
        description:
          "Read relevant message threads for follow-up and relationship context.",
        operation: "read",
      },
      {
        id: "email-draft-actions",
        label: "Email draft actions",
        description: "Prepare drafts for explicit human review and approval.",
        operation: "write",
      },
    ],
    // OAuth flow (with PKCE) and Vault-backed token storage are real and
    // tested, sharing packages/integrations/src/shared/microsoft-oauth.ts
    // with Microsoft Calendar. Disconnect is local-only — Microsoft has no
    // documented third-party single-token revoke endpoint (see that
    // module's doc comment). Sync and actions are not built yet, and no
    // real Microsoft Entra app credentials exist yet.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0",
      configuration: "code-ready",
      scopesDefined: true,
      scopes: MICROSOFT_OUTLOOK_SCOPES,
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: false,
      actionsImplemented: false,
      productionReady: false,
    },
    supportedEntityTypes: ["email", "message", "contact"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "stripe",
    name: "Stripe",
    shortDescription:
      "Surface payment activity, revenue movement, and account health signals.",
    category: "payments",
    purpose: "payments",
    availability: "foundation-preview",
    direction: "inbound",
    accessPosture: "read-only",
    capabilities: [
      {
        id: "payment-insights",
        label: "Payment insights",
        description:
          "Read payment and account activity for revenue and risk signals.",
        operation: "read",
      },
    ],
    // OAuth flow is real and tested; unlike HubSpot/Slack, Stripe's own
    // current docs mark the token response's access/refresh tokens
    // "(Deprecated)" — future API calls use this platform's secret key
    // plus a Stripe-Account header, so no per-tenant token is stored, only
    // the connected account id. Sync and actions are not built yet, and no
    // real Stripe Connect app credentials exist yet.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0 (Stripe Connect)",
      configuration: "code-ready",
      scopesDefined: true,
      scopes: [STRIPE_SCOPE],
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: false,
      actionsImplemented: false,
      productionReady: false,
    },
    supportedEntityTypes: ["payment", "invoice"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: true,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "quickbooks",
    name: "QuickBooks",
    shortDescription:
      "Bring accounting context into cash-flow and financial health views.",
    category: "accounting",
    purpose: "finance",
    availability: "foundation-preview",
    direction: "inbound",
    accessPosture: "read-only",
    capabilities: [
      {
        id: "accounting-insights",
        label: "Accounting insights",
        description:
          "Read summarized accounting activity for business health signals.",
        operation: "read",
      },
    ],
    // OAuth flow and Vault-backed token storage are real and tested,
    // mirroring HubSpot's connector. QuickBooks Online's OAuth scope is
    // coarse-grained (see client.ts) — there is no read-only scope to
    // request, so this app enforces read-only by which endpoints it calls,
    // not by what it asks Intuit for. Sync and actions are not built yet,
    // and no real Intuit app credentials exist yet.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0",
      configuration: "code-ready",
      scopesDefined: true,
      scopes: QUICKBOOKS_SCOPES,
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: true,
      actionsImplemented: false,
      productionReady: false,
    },
    // Only "invoice" has a real mapper today (mirroring HubSpot's own
    // "only lead is real" comment above) — a one-time sync-on-connect
    // that ingests open, overdue invoices; "payment" remains design
    // intent, and syncImplemented stays false since this isn't recurring
    // background sync (same distinction HubSpot's own entry documents).
    supportedEntityTypes: ["invoice", "payment"],
    dataSensitivity: {
      containsPII: false,
      containsFinancialData: true,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "google-calendar",
    name: "Google Calendar",
    shortDescription:
      "Connect schedules and meetings to customer and delivery priorities.",
    category: "calendar",
    purpose: "calendar",
    availability: "foundation-preview",
    direction: "bidirectional",
    accessPosture: "read-write",
    capabilities: [
      {
        id: "schedule-insights",
        label: "Schedule insights",
        description:
          "Read relevant schedule context for planning and follow-up signals.",
        operation: "read",
      },
      {
        id: "calendar-event-actions",
        label: "Calendar event actions",
        description:
          "Prepare event changes for explicit human review and approval.",
        operation: "write",
      },
    ],
    // OAuth flow and Vault-backed token storage are real and tested,
    // sharing packages/integrations/src/shared/google-oauth.ts with
    // Gmail — a genuinely separate grant even though both share one
    // Google Cloud OAuth client. Sync and actions are not built yet, and
    // no real Google Cloud OAuth client credentials exist yet.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0",
      configuration: "code-ready",
      scopesDefined: true,
      scopes: GOOGLE_CALENDAR_SCOPES,
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: false,
      actionsImplemented: false,
      productionReady: false,
    },
    supportedEntityTypes: ["calendar_event"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "microsoft-calendar",
    name: "Microsoft Calendar",
    shortDescription:
      "Connect Microsoft schedules to customer and delivery priorities.",
    category: "calendar",
    purpose: "calendar",
    availability: "foundation-preview",
    direction: "bidirectional",
    accessPosture: "read-write",
    capabilities: [
      {
        id: "schedule-insights",
        label: "Schedule insights",
        description:
          "Read relevant schedule context for planning and follow-up signals.",
        operation: "read",
      },
      {
        id: "calendar-event-actions",
        label: "Calendar event actions",
        description:
          "Prepare event changes for explicit human review and approval.",
        operation: "write",
      },
    ],
    // OAuth flow (with PKCE) and Vault-backed token storage are real and
    // tested, sharing packages/integrations/src/shared/microsoft-oauth.ts
    // with Microsoft Outlook — a genuinely separate grant even though both
    // share one Microsoft Entra app registration. Disconnect is
    // local-only (see that module's doc comment on Microsoft's revocation
    // gap). Sync and actions are not built yet, and no real Microsoft
    // Entra app credentials exist yet.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0",
      configuration: "code-ready",
      scopesDefined: true,
      scopes: MICROSOFT_CALENDAR_SCOPES,
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: false,
      actionsImplemented: false,
      productionReady: false,
    },
    supportedEntityTypes: ["calendar_event"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "asana",
    name: "Asana",
    shortDescription:
      "Bring projects, tasks, and delivery status into the operating view.",
    category: "project-management",
    purpose: "delivery",
    availability: "foundation-preview",
    direction: "bidirectional",
    accessPosture: "read-write",
    capabilities: [
      {
        id: "work-item-insights",
        label: "Work item insights",
        description:
          "Read project and task context for delivery and capacity signals.",
        operation: "read",
      },
      {
        id: "work-item-actions",
        label: "Work item actions",
        description:
          "Prepare task changes for explicit human review and approval.",
        operation: "write",
      },
    ],
    // OAuth flow and Vault-backed token storage are real and tested.
    // No real Asana app credentials exist yet.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0",
      configuration: "code-ready",
      scopesDefined: true,
      scopes: ASANA_SCOPES,
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: true,
      actionsImplemented: false,
      productionReady: false,
    },
    // "task" has a real mapper today (mirroring HubSpot/QuickBooks's own
    // "only X is real" comments above) — a one-time sync-on-connect that
    // ingests overdue, incomplete tasks assigned to the connected user
    // across every workspace they belong to.
    supportedEntityTypes: ["task"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: false,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "linear",
    name: "Linear",
    shortDescription:
      "Bring issues, projects, and delivery progress into the operating view.",
    category: "project-management",
    purpose: "delivery",
    availability: "foundation-preview",
    direction: "bidirectional",
    accessPosture: "read-write",
    capabilities: [
      {
        id: "work-item-insights",
        label: "Work item insights",
        description:
          "Read project and issue context for delivery and capacity signals.",
        operation: "read",
      },
      {
        id: "work-item-actions",
        label: "Work item actions",
        description:
          "Prepare issue changes for explicit human review and approval.",
        operation: "write",
      },
    ],
    // OAuth flow and Vault-backed token storage are real and tested.
    // Sync and actions are not built yet, and no real Linear app
    // credentials exist yet.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0",
      configuration: "code-ready",
      scopesDefined: true,
      scopes: LINEAR_SCOPES,
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: false,
      actionsImplemented: false,
      productionReady: false,
    },
    supportedEntityTypes: ["task"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: false,
    },
    trustClassification: "first_party",
  }),
] as const satisfies readonly ConnectorDefinition[];

export type ConnectorSlug =
  | "slack"
  | "hubspot"
  | "gmail"
  | "microsoft-outlook"
  | "stripe"
  | "quickbooks"
  | "google-calendar"
  | "microsoft-calendar"
  | "asana"
  | "linear";

export interface ConnectorFilters {
  readonly category?: ConnectorCategory;
  readonly availability?: ConnectorAvailability;
  readonly operation?: ConnectorOperation;
  readonly direction?: ConnectorDirection;
  readonly accessPosture?: ConnectorAccessPosture;
}

export function getConnectorBySlug(
  slug: string,
): ConnectorDefinition | undefined {
  return connectorCatalog.find((connector) => connector.slug === slug);
}

export function listConnectors(): readonly ConnectorDefinition[] {
  return connectorCatalog;
}

export type CategoryCoverageStatus = "none" | "partial" | "connected";

export interface CategoryCoverage {
  readonly category: ConnectorCategory;
  readonly status: CategoryCoverageStatus;
  readonly connectedCount: number;
  readonly totalCount: number;
}

/**
 * Real coverage, computed from real connection state — never a fabricated
 * "strong/limited" label. `connectedSlugs` should come from
 * `listActiveIntegrationSourceSystems` (`@business-dashboard/persistence`);
 * this function only aggregates it against the catalog. A category with
 * zero cataloged connectors doesn't appear at all, since "0 of 0 connected"
 * isn't a coverage gap — it's a category with no catalog entry yet.
 */
export function computeBusinessCoverage(
  connectedSlugs: readonly string[],
): readonly CategoryCoverage[] {
  const byCategory = new Map<
    ConnectorCategory,
    { connected: number; total: number }
  >();

  for (const connector of connectorCatalog) {
    const entry = byCategory.get(connector.category) ?? {
      connected: 0,
      total: 0,
    };
    entry.total += 1;
    if (connectedSlugs.includes(connector.slug)) {
      entry.connected += 1;
    }
    byCategory.set(connector.category, entry);
  }

  return [...byCategory.entries()].map(([category, entry]) => ({
    category,
    status:
      entry.connected === 0
        ? "none"
        : entry.connected === entry.total
          ? "connected"
          : "partial",
    connectedCount: entry.connected,
    totalCount: entry.total,
  }));
}

export type PurposeCoverageStatus = "none" | "partial" | "connected";

export interface PurposeCoverage {
  readonly purpose: ConnectorPurpose;
  readonly status: PurposeCoverageStatus;
  /** Which of this purpose's connectors are actually connected, by name —
   * what the Integration Hub's "Pipeline → HubSpot ✓ Live" style Business
   * Data Map needs to render, not just a count. */
  readonly connectedConnectorNames: readonly string[];
  readonly totalConnectorNames: readonly string[];
}

/**
 * The same real, connection-state-derived coverage as `computeBusinessCoverage`,
 * grouped by business purpose instead of technical category — "where does
 * your pipeline/money/team communication live," matching how the
 * Integration Hub is meant to read post-onboarding.
 */
export function computeBusinessCoverageByPurpose(
  connectedSlugs: readonly string[],
): readonly PurposeCoverage[] {
  const byPurpose = new Map<
    ConnectorPurpose,
    { connected: string[]; total: string[] }
  >();

  for (const connector of connectorCatalog) {
    const entry = byPurpose.get(connector.purpose) ?? {
      connected: [],
      total: [],
    };
    entry.total.push(connector.name);
    if (connectedSlugs.includes(connector.slug)) {
      entry.connected.push(connector.name);
    }
    byPurpose.set(connector.purpose, entry);
  }

  return [...byPurpose.entries()].map(([purpose, entry]) => ({
    purpose,
    status:
      entry.connected.length === 0
        ? "none"
        : entry.connected.length === entry.total.length
          ? "connected"
          : "partial",
    connectedConnectorNames: entry.connected,
    totalConnectorNames: entry.total,
  }));
}

export function filterConnectors(
  filters: ConnectorFilters,
): readonly ConnectorDefinition[] {
  return connectorCatalog.filter(
    (connector) =>
      (filters.category === undefined ||
        connector.category === filters.category) &&
      (filters.availability === undefined ||
        connector.availability === filters.availability) &&
      (filters.operation === undefined ||
        connector.capabilities.some(
          (capability) => capability.operation === filters.operation,
        )) &&
      (filters.direction === undefined ||
        connector.direction === filters.direction) &&
      (filters.accessPosture === undefined ||
        connector.accessPosture === filters.accessPosture),
  );
}
