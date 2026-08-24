import { ASANA_SCOPES } from "./asana/client";
import { GMAIL_SCOPES } from "./gmail/client";
import { GOOGLE_CALENDAR_SCOPES } from "./google-calendar/client";
import { HUBSPOT_SCOPES } from "./hubspot/client";
import { JIRA_SCOPES } from "./jira/client";
import { LINEAR_SCOPES } from "./linear/client";
import { MICROSOFT_CALENDAR_SCOPES } from "./microsoft-calendar/client";
import { MICROSOFT_OUTLOOK_SCOPES } from "./microsoft-outlook/client";
import { QUICKBOOKS_SCOPES } from "./quickbooks/client";
import { SALESFORCE_SCOPES } from "./salesforce/client";
import { SLACK_SCOPES } from "./slack/client";
import { STRIPE_SCOPE } from "./stripe/client";
import { XERO_SCOPES } from "./xero/client";
import { ZENDESK_SCOPES } from "./zendesk/client";

/**
 * The single connector classification (ADR 0021) — supersedes the earlier
 * `ConnectorCategory` (technical "what kind of tool is this") and
 * `ConnectorPurpose` (business-framing, 6 values) taxonomies, which
 * overlapped without either being general enough for a genuinely
 * provider-independent catalog. A connector declares every class it
 * honestly belongs to today, regardless of implementation status — most
 * declare exactly one; a future multi-domain tool (e.g. a full ERP) could
 * declare several. A class with zero catalog entries is not an error, the
 * same way a category with zero entries never appeared in coverage output
 * before this change — it just means no connector fills that role yet.
 */
export const connectorCapabilityClasses = [
  "identity",
  "crm",
  "communication",
  "calendar",
  "projects",
  "tasks",
  "time",
  "accounting",
  "payments",
  "documents",
  "contracts",
  "support",
  "hr",
  "ats",
  "commerce",
  "inventory",
  "field-service",
  "psa",
  "rmm",
  "security",
  "product-analytics",
  "data-warehouse",
] as const;

export type ConnectorCapabilityClass =
  (typeof connectorCapabilityClasses)[number];

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
  /** Scheduled/cron background polling specifically — not yet true for any
   * connector, including QuickBooks, which has a real webhook receiver
   * (ADR 0022) but that is event-triggered, not a timer-driven poller;
   * conflating the two would overclaim what actually exists. See
   * `initialSyncImplemented`/`incrementalSyncImplemented` for the
   * narrower, already-real distinctions that don't require either. */
  readonly syncImplemented: boolean;
  /** A real one-time sync-on-connect into the Business Graph (HubSpot
   * deals→leads, QuickBooks invoices, Asana tasks) — previously only
   * documented as prose ("only 'invoice' has a real mapper today") on
   * three connectors' entries below; now a typed, checkable fact so
   * callers (e.g. connector health summaries) don't have to duplicate
   * that knowledge as a hardcoded list. */
  readonly initialSyncImplemented: boolean;
  /** A real, cursor-filtered fetch that only pulls records changed since
   * the last successful sync (ADR 0021) — true for 8 connectors as of
   * 2026-08-24 (hubspot, gmail, quickbooks, asana, salesforce, jira,
   * xero, zendesk), each storing a real cursor per run and demonstrably
   * consuming it on the next (a query filter, an `If-Modified-Since`
   * header, or — Zendesk — the same cursor endpoint reused for both
   * initial and delta runs). `false` for every other connector, most of
   * which have no sync at all yet. */
  readonly incrementalSyncImplemented: boolean;
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
 * `document`/`contract`/`support_ticket` (ADR 0021) exist for the
 * documents/contracts/support connectors added in that pass — none of the
 * original 9 values honestly fit a DocuSign envelope or a Zendesk ticket,
 * and forcing one onto an unrelated value would itself be a pretended
 * capability.
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
  | "payment"
  | "document"
  | "contract"
  | "support_ticket";

/**
 * Design-intent data-sensitivity classification, not a runtime data-flow
 * audit — a connector with zero live data flow (twenty-two of twenty-five
 * today) still has a defensible answer for "if this were connected, what
 * kind of data would it carry," which is what privacy/redaction decisions
 * need.
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
  readonly capabilityClasses: readonly ConnectorCapabilityClass[];
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
  incrementalSyncImplemented: false,
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
    capabilityClasses: ["communication"],
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
      incrementalSyncImplemented: false,
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
    capabilityClasses: ["crm"],
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
      // Event-triggered only (connect, manual "Sync Now") — HubSpot's own
      // current webhook mechanism (v4) is poll-based, not push, and this
      // app has no scheduler/background-job runner to poll it with
      // (ADR 0023). Not the same gap as QuickBooks, which has a real push
      // webhook endpoint.
      syncImplemented: false,
      initialSyncImplemented: true,
      // Real once ADR 0023 shipped: an incremental run's fetch is filtered
      // by the stored cursor via HubSpot's Search API
      // (fetchHubSpotDealsModifiedSince), not the plain list endpoint.
      incrementalSyncImplemented: true,
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
    capabilityClasses: ["communication"],
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
    // Google Calendar. Real message sync exists as of Phase 4b
    // (implementation roadmap): bounded to the last 30 days, external
    // correspondence only, both an initial (on connect) and a real
    // incremental (cursor-based) run via "Sync Now." Actions (drafting
    // replies) are not built. productionReady stays false: this dev
    // environment has no real Google Cloud OAuth client configured
    // (GOOGLE_CLIENT_ID/SECRET are blank), so the real sync path has
    // been verified by fixture and live-database tests only, not against
    // a real live Gmail account end-to-end — see docs/adr/0050-gmail-
    // message-ingestion.md.
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
      initialSyncImplemented: true,
      incrementalSyncImplemented: true,
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
    capabilityClasses: ["communication"],
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
      incrementalSyncImplemented: false,
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
    capabilityClasses: ["payments"],
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
      incrementalSyncImplemented: false,
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
    capabilityClasses: ["accounting"],
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
    // not by what it asks Intuit for. Actions are not built yet, and no
    // real Intuit app credentials exist yet.
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
      // Still not a scheduled/cron poller — event-triggered only (connect,
      // manual "Sync Now", and the real webhook receiver, ADR 0022).
      // Conflating "event-triggered" with "recurring background polling"
      // would overclaim what this actually is.
      syncImplemented: false,
      initialSyncImplemented: true,
      // Real once ADR 0022 shipped: the fetch query is filtered by the
      // stored cursor on every non-initial run, for both invoices and
      // payments.
      incrementalSyncImplemented: true,
      actionsImplemented: false,
      productionReady: false,
    },
    // Both "invoice" and "payment" have real mappers now (ADR 0022) —
    // invoice sync also observes a real open→paid status transition via
    // a second "closed since cursor" query pass, and a real signed
    // webhook endpoint (Intuit configures this once per app, not
    // per-connection) triggers a targeted incremental sync on either
    // entity's change.
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
    capabilityClasses: ["calendar"],
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
      incrementalSyncImplemented: false,
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
    capabilityClasses: ["calendar"],
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
      incrementalSyncImplemented: false,
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
    capabilityClasses: ["projects"],
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
      incrementalSyncImplemented: true,
      actionsImplemented: false,
      productionReady: false,
    },
    // "task" has a real mapper today (mirroring HubSpot/QuickBooks's own
    // "only X is real" comments above) — sync-on-connect and "Sync Now"
    // ingest overdue, incomplete tasks assigned to the connected user
    // across every workspace they belong to; a non-initial run filters by
    // `modified_since` using the stored cursor (ADR 0024). No webhook:
    // Asana's own mechanism is genuinely push-based (unlike HubSpot's
    // poll-only journal), but building one wasn't in this round's scope.
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
    capabilityClasses: ["projects"],
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
      incrementalSyncImplemented: false,
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
  // --- ADR 0021: metadata-only entries, interleaved with real ones below ---
  //
  // Originally 15 metadata-only entries below this comment; four
  // (salesforce, jira, xero, zendesk) were later promoted to real OAuth
  // connectors in place, not moved above this comment, so this section is
  // now a mix — 11 still metadata-only, 4 real — in the order each was
  // added, not grouped by status. Each metadata-only entry omits
  // `authStrategy`/`readiness`, so `defineConnector()` applies
  // `plannedOAuth2`/`notImplementedReadiness` — zero real code, every
  // readiness flag honestly `false`, `availability: "planned"`. A real
  // entry here carries its own explicit `authStrategy`/`readiness` and
  // `availability: "foundation-preview"`, identical in shape to the 10
  // connectors above this comment that have always been real — the
  // position below this line no longer implies planned-only; the
  // presence of `readiness`/`authStrategy` on the entry itself does.
  // This section deliberately overrides this catalog's own prior "no
  // roadmap connector marked as implemented" discipline — see ADR 0021
  // for why, and the explicit honesty condition it was overridden under.
  defineConnector({
    slug: "salesforce",
    name: "Salesforce",
    shortDescription:
      "Surface customer, opportunity, and pipeline activity from Salesforce.",
    capabilityClasses: ["crm"],
    availability: "foundation-preview",
    direction: "bidirectional",
    accessPosture: "read-write",
    capabilities: [
      {
        id: "crm-record-insights",
        label: "CRM record insights",
        description:
          "Read customer and opportunity records for deterministic operational signals.",
        operation: "read",
      },
      {
        id: "crm-record-actions",
        label: "CRM record actions",
        description: "Prepare governed record updates after explicit approval.",
        operation: "write",
      },
    ],
    // OAuth 2.0 web server flow, Vault-backed token storage, and a real
    // Opportunity sync into leads are implemented and tested, mirroring
    // HubSpot's own connector (ADR 0008) — SOQL's parent-relationship
    // traversal (`Owner.Name`) gets owner names in the same query, no
    // separate Owners endpoint needed unlike HubSpot. `LastModifiedDate`
    // is filtered on every non-initial run
    // (`incrementalSyncImplemented: true`). No real Salesforce Connected
    // App credentials exist yet in this environment.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0",
      configuration: "code-ready",
      scopesDefined: true,
      // Sourced from the real client, not re-typed here — see the same
      // rationale on HubSpot's entry above.
      scopes: SALESFORCE_SCOPES,
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: true,
      incrementalSyncImplemented: true,
      actionsImplemented: false,
      productionReady: false,
    },
    supportedEntityTypes: ["lead", "contact", "company"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: true,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "pipedrive",
    name: "Pipedrive",
    shortDescription:
      "Surface customer, deal, and pipeline activity from Pipedrive.",
    capabilityClasses: ["crm"],
    availability: "planned",
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
    supportedEntityTypes: ["lead", "contact", "company"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: true,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "microsoft-teams",
    name: "Microsoft Teams",
    shortDescription:
      "Bring team conversations and operational alerts into the command center.",
    capabilityClasses: ["communication"],
    availability: "planned",
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
    supportedEntityTypes: ["message"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: false,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "clickup",
    name: "ClickUp",
    shortDescription:
      "Bring projects, tasks, and delivery status into the operating view.",
    capabilityClasses: ["projects"],
    availability: "planned",
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
    supportedEntityTypes: ["task"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: false,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "monday-com",
    name: "Monday.com",
    shortDescription:
      "Bring boards, tasks, and delivery status into the operating view.",
    capabilityClasses: ["projects"],
    availability: "planned",
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
    supportedEntityTypes: ["task"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: false,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "teamwork",
    name: "Teamwork",
    shortDescription:
      "Bring projects, tasks, and delivery status into the operating view.",
    capabilityClasses: ["projects"],
    availability: "planned",
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
    supportedEntityTypes: ["task"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: false,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "jira",
    name: "Jira",
    shortDescription:
      "Bring issues, projects, and delivery progress into the operating view.",
    capabilityClasses: ["projects"],
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
    // OAuth 2.0 (3LO), Vault-backed token storage, and a real open-issue
    // sync into tasks are implemented and tested, mirroring Asana's own
    // connector — including real cursor-filtered incremental sync via
    // JQL's own quoted date-literal format. No real Atlassian app
    // credentials exist yet in this environment. `work-item-actions`
    // stays product-intent only, like every other connector's declared
    // write capability — no write endpoint is implemented.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0",
      configuration: "code-ready",
      scopesDefined: true,
      // Sourced from the real client, not re-typed here — see the same
      // rationale on HubSpot's entry above.
      scopes: JIRA_SCOPES,
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: true,
      incrementalSyncImplemented: true,
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
  defineConnector({
    slug: "github",
    // GitHub's fit under this taxonomy is the weakest of the 15: none of
    // the 22 classes is "source control." Issues and pull requests are
    // real work items though — the same reasoning that puts Jira/ClickUp
    // under "projects" — so that's the deliberate best fit, not a clean
    // match. `security` (dependabot/code scanning) was considered and
    // rejected: it isn't GitHub's primary value here.
    name: "GitHub",
    shortDescription:
      "Bring issues, pull requests, and delivery progress into the operating view.",
    capabilityClasses: ["projects"],
    availability: "planned",
    direction: "bidirectional",
    accessPosture: "read-write",
    capabilities: [
      {
        id: "work-item-insights",
        label: "Work item insights",
        description:
          "Read issue and pull request context for delivery and capacity signals.",
        operation: "read",
      },
      {
        id: "work-item-actions",
        label: "Work item actions",
        description:
          "Prepare issue or pull request changes for explicit human review and approval.",
        operation: "write",
      },
    ],
    supportedEntityTypes: ["task"],
    dataSensitivity: {
      containsPII: false,
      containsFinancialData: false,
      containsCustomerData: false,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "xero",
    name: "Xero",
    shortDescription:
      "Bring accounting context into cash-flow and financial health views.",
    capabilityClasses: ["accounting"],
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
    // OAuth 2.0, Vault-backed token storage, and a real open-invoice sync
    // into invoices are implemented and tested, mirroring QuickBooks' own
    // connector (its second-most-similar precedent, ADR 0022) — including
    // the same closed-invoice second pass, adapted to Xero's real
    // `Status=="PAID"` filter. No real Xero app credentials exist yet in
    // this environment.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0",
      configuration: "code-ready",
      scopesDefined: true,
      // Sourced from the real client, not re-typed here — see the same
      // rationale on HubSpot's entry above.
      scopes: XERO_SCOPES,
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: true,
      incrementalSyncImplemented: true,
      actionsImplemented: false,
      productionReady: false,
    },
    supportedEntityTypes: ["invoice", "payment"],
    dataSensitivity: {
      containsPII: false,
      containsFinancialData: true,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "dropbox",
    name: "Dropbox",
    shortDescription:
      "Bring file and document context into client and delivery workflows.",
    capabilityClasses: ["documents"],
    availability: "planned",
    direction: "inbound",
    accessPosture: "read-only",
    capabilities: [
      {
        id: "document-insights",
        label: "Document insights",
        description:
          "Read file and folder activity for delivery and client context.",
        operation: "read",
      },
    ],
    supportedEntityTypes: ["document"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "google-drive",
    name: "Google Drive",
    shortDescription:
      "Bring file and document context into client and delivery workflows.",
    capabilityClasses: ["documents"],
    availability: "planned",
    direction: "inbound",
    accessPosture: "read-only",
    capabilities: [
      {
        id: "document-insights",
        label: "Document insights",
        description:
          "Read file and folder activity for delivery and client context.",
        operation: "read",
      },
    ],
    supportedEntityTypes: ["document"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "sharepoint",
    name: "SharePoint",
    shortDescription:
      "Bring Microsoft file and document context into client and delivery workflows.",
    capabilityClasses: ["documents"],
    availability: "planned",
    direction: "inbound",
    accessPosture: "read-only",
    capabilities: [
      {
        id: "document-insights",
        label: "Document insights",
        description:
          "Read file and folder activity for delivery and client context.",
        operation: "read",
      },
    ],
    supportedEntityTypes: ["document"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "zendesk",
    name: "Zendesk",
    shortDescription:
      "Bring customer support conversations and ticket health into view.",
    capabilityClasses: ["support"],
    availability: "foundation-preview",
    direction: "bidirectional",
    accessPosture: "read-write",
    capabilities: [
      {
        id: "support-ticket-insights",
        label: "Support ticket insights",
        description: "Read ticket status and history for support signals.",
        operation: "read",
      },
      {
        id: "support-ticket-actions",
        label: "Support ticket actions",
        description: "Prepare governed ticket replies after explicit approval.",
        operation: "write",
      },
    ],
    // OAuth 2.0, Vault-backed token storage, and a real open-ticket sync
    // into the first support-domain Business Graph entity
    // (`support_tickets`) are implemented and tested — the first
    // connector for a genuinely new canonical entity since Gmail's
    // `messages` (ADR 0050). Real cursor-filtered incremental sync via
    // Zendesk's own cursor-based incremental export endpoint. No real
    // Zendesk OAuth client credentials exist yet in this environment.
    // `support-ticket-actions` stays product-intent only, like every
    // other connector's declared write capability — no write endpoint is
    // implemented.
    authStrategy: {
      kind: "oauth2",
      label: "OAuth 2.0",
      configuration: "code-ready",
      scopesDefined: true,
      // Sourced from the real client, not re-typed here — see the same
      // rationale on HubSpot's entry above.
      scopes: ZENDESK_SCOPES,
    },
    readiness: {
      catalogMetadata: true,
      adapterImplemented: true,
      authorizationImplemented: true,
      syncImplemented: false,
      initialSyncImplemented: true,
      incrementalSyncImplemented: true,
      actionsImplemented: false,
      productionReady: false,
    },
    supportedEntityTypes: ["support_ticket"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "intercom",
    name: "Intercom",
    shortDescription:
      "Bring customer support and messaging conversations into view.",
    capabilityClasses: ["support"],
    availability: "planned",
    direction: "bidirectional",
    accessPosture: "read-write",
    capabilities: [
      {
        id: "support-ticket-insights",
        label: "Support ticket insights",
        description:
          "Read conversation status and history for support signals.",
        operation: "read",
      },
      {
        id: "support-ticket-actions",
        label: "Support ticket actions",
        description:
          "Prepare governed conversation replies after explicit approval.",
        operation: "write",
      },
    ],
    supportedEntityTypes: ["support_ticket"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: true,
    },
    trustClassification: "first_party",
  }),
  defineConnector({
    slug: "docusign",
    name: "DocuSign",
    shortDescription:
      "Track contract and envelope status without leaving the command center.",
    capabilityClasses: ["contracts"],
    availability: "planned",
    direction: "inbound",
    accessPosture: "read-only",
    capabilities: [
      {
        id: "contract-status-insights",
        label: "Contract status insights",
        description:
          "Read envelope and signature status for contract tracking.",
        operation: "read",
      },
    ],
    supportedEntityTypes: ["contract"],
    dataSensitivity: {
      containsPII: true,
      containsFinancialData: false,
      containsCustomerData: true,
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
  | "linear"
  | "salesforce"
  | "pipedrive"
  | "microsoft-teams"
  | "clickup"
  | "monday-com"
  | "teamwork"
  | "jira"
  | "github"
  | "xero"
  | "dropbox"
  | "google-drive"
  | "sharepoint"
  | "zendesk"
  | "intercom"
  | "docusign";

/**
 * No production caller today — `integration-explorer.tsx`'s real
 * search/category filter is client-side `useState` over already-fetched
 * props, not a call into this package. Kept because `packages/integrations/tests/catalog.test.ts`
 * genuinely relies on it (7 real assertions: "every planned connector
 * has X," "every foundation-preview connector has Y," ...) to select a
 * meaningful catalog subset rather than hand-filtering in each test —
 * real, tested, in-use code, just by the test suite rather than the app
 * (found and disclosed in a dead-code audit this session, per the same
 * "kept ahead of need" pattern `getInternalCostSummary` already uses,
 * not silently left undocumented).
 */
export interface ConnectorFilters {
  readonly capabilityClass?: ConnectorCapabilityClass;
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

/** First-party record sources that never appear in the connector catalog
 * (no OAuth, no vendor, no capability class — adding one there would
 * misrepresent it as a real third-party integration) but still need a
 * customer-comprehensible label wherever a `source.system` value is shown
 * — e.g. `WhyDisclosure`'s "Source evidence" panel. Keep in sync with the
 * literal `sourceSystem` values each first-party ingestion path writes
 * (currently just the CSV import escape hatch,
 * `packages/persistence/src/csv-import.ts`). */
const NON_CATALOG_SOURCE_SYSTEM_LABELS: Record<string, string> = {
  csv_import: "CSV import",
};

/**
 * The one place that turns any real `source.system` value — a connector
 * catalog slug or a first-party ingestion path's own literal — into a
 * label a customer can actually read, rather than each call site
 * re-deriving its own fallback. Never hides the real value: an
 * unrecognized system still renders as-is rather than a generic
 * placeholder, since an honest raw string beats a fabricated label.
 */
export function getSourceSystemLabel(system: string): string {
  return (
    getConnectorBySlug(system)?.name ??
    NON_CATALOG_SOURCE_SYSTEM_LABELS[system] ??
    system
  );
}

export function listConnectors(): readonly ConnectorDefinition[] {
  return connectorCatalog;
}

export type CapabilityCoverageStatus = "none" | "partial" | "connected";

export interface CapabilityCoverage {
  readonly capabilityClass: ConnectorCapabilityClass;
  readonly status: CapabilityCoverageStatus;
  /** Which of this class's connectors are actually connected, by name —
   * what the Integration Hub's "CRM → HubSpot ✓ Live" style Business Data
   * Map needs to render, not just a count. */
  readonly connectedConnectorNames: readonly string[];
  readonly totalConnectorNames: readonly string[];
}

/**
 * Real coverage, computed from real connection state — never a fabricated
 * "strong/limited" label. `connectedSlugs` should come from
 * `listActiveIntegrationSourceSystems` (`@signaldesk/persistence`); this
 * function only aggregates it against the catalog, grouped by business
 * capability class instead of app logo, so SignalDesk can answer "do I
 * have trustworthy CRM/accounting/project coverage" regardless of which
 * vendor fills it. A connector declaring more than one class contributes
 * to each. A class with zero cataloged connectors doesn't appear at all,
 * since "0 of 0 connected" isn't a coverage gap — it's a class with no
 * catalog entry yet.
 */
export function computeBusinessCoverageByCapability(
  connectedSlugs: readonly string[],
): readonly CapabilityCoverage[] {
  const byClass = new Map<
    ConnectorCapabilityClass,
    { connected: string[]; total: string[] }
  >();

  for (const connector of connectorCatalog) {
    for (const capabilityClass of connector.capabilityClasses) {
      const entry = byClass.get(capabilityClass) ?? {
        connected: [],
        total: [],
      };
      entry.total.push(connector.name);
      if (connectedSlugs.includes(connector.slug)) {
        entry.connected.push(connector.name);
      }
      byClass.set(capabilityClass, entry);
    }
  }

  return [...byClass.entries()].map(([capabilityClass, entry]) => ({
    capabilityClass,
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

/**
 * Which vertical an organization identifies as, for the sole purpose of
 * recommending which `ConnectorCapabilityClass`es matter most to it (ADR
 * 0019). `"unspecified"` is the honest default — no industry has been
 * guessed at it, so no recommendation is shown for it. Deliberately
 * limited to the one vertical this catalog actually serves well today (see
 * `industryProfiles` below); this is NOT the full multi-vertical "industry
 * pack" framework proposed elsewhere (see `docs/product-vision-backlog.md`)
 * — no terminology overrides, signal/playbook/artifact definitions, or
 * marketplace, none of which have a real engine to attach to yet.
 */
export const organizationIndustries = [
  "unspecified",
  "professional_services",
] as const;

export type OrganizationIndustry = (typeof organizationIndustries)[number];

export interface IndustryProfile {
  readonly id: Exclude<OrganizationIndustry, "unspecified">;
  readonly name: string;
  readonly recommendedCapabilityClasses: readonly ConnectorCapabilityClass[];
}

/**
 * Exactly one real profile — this catalog's real, foundation-preview
 * connectors (HubSpot/QuickBooks/Asana plus the other seven OAuth-only
 * ones) are, by their own capability mix, already shaped for an
 * agency/consultancy: a pipeline, delivery work, invoicing, and team
 * communication. Adding entries for other verticals (MSP, e-commerce,
 * recruiting, ...) before a real connector exists to back their
 * recommendations would just be fabricated coverage advice — see the
 * industry-pack backlog entry for the intended sequence.
 */
export const industryProfiles: Record<
  Exclude<OrganizationIndustry, "unspecified">,
  IndustryProfile
> = {
  professional_services: {
    id: "professional_services",
    name: "Professional services / agency",
    recommendedCapabilityClasses: [
      "crm",
      "projects",
      "accounting",
      "communication",
    ],
  },
};

export interface IndustryCoverage {
  readonly industry: Exclude<OrganizationIndustry, "unspecified">;
  readonly name: string;
  readonly recommended: readonly CapabilityCoverage[];
}

/**
 * Takes `industry` as a plain `string` rather than `OrganizationIndustry`
 * so callers (like `apps/web`, reading the persisted value back from
 * `@signaldesk/persistence`, which doesn't depend on this package and
 * stores industry as plain text) don't need to assert its type themselves.
 * Returns `null` for `"unspecified"` or anything else with no real
 * profile — there is nothing honest to recommend without a known industry.
 * Otherwise, the subset of `computeBusinessCoverageByCapability`'s output
 * that this industry's profile actually recommends, in the profile's own
 * order.
 */
export function computeIndustryCoverage(
  industry: string,
  connectedSlugs: readonly string[],
): IndustryCoverage | null {
  if (!Object.hasOwn(industryProfiles, industry)) {
    return null;
  }

  const profile =
    industryProfiles[industry as Exclude<OrganizationIndustry, "unspecified">];
  const allCoverage = computeBusinessCoverageByCapability(connectedSlugs);
  const coverageByClass = new Map(
    allCoverage.map((coverage) => [coverage.capabilityClass, coverage]),
  );

  return {
    industry: profile.id,
    name: profile.name,
    recommended: profile.recommendedCapabilityClasses
      .map((capabilityClass) => coverageByClass.get(capabilityClass))
      .filter(
        (coverage): coverage is CapabilityCoverage => coverage !== undefined,
      ),
  };
}

export function filterConnectors(
  filters: ConnectorFilters,
): readonly ConnectorDefinition[] {
  return connectorCatalog.filter(
    (connector) =>
      (filters.capabilityClass === undefined ||
        connector.capabilityClasses.includes(filters.capabilityClass)) &&
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

export type { SourceMapping } from "./shared/source-mapping";
export type {
  WebhookSubscription,
  WebhookSubscriptionStatus,
} from "./shared/webhook-subscription";
