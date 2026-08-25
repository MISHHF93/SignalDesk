import type { ComponentType, ReactNode } from "react";

import {
  createDatabasePool,
  getAsanaIntegrationStatus,
  getGmailIntegrationStatus,
  getGoogleCalendarIntegrationStatus,
  getHubSpotIntegrationStatus,
  getJiraIntegrationStatus,
  getLinearIntegrationStatus,
  getMicrosoftCalendarIntegrationStatus,
  getMicrosoftOutlookIntegrationStatus,
  getQuickBooksIntegrationStatus,
  getSalesforceIntegrationStatus,
  getSlackIntegrationStatus,
  getStripeIntegrationStatus,
  getXeroIntegrationStatus,
  getZendeskIntegrationStatus,
} from "@signaldesk/persistence";

import { isAsanaConfigured } from "../../_lib/asana-config";
import { isGoogleConfigured } from "../../_lib/google-config";
import { isHubSpotConfigured } from "../../_lib/hubspot-config";
import { isJiraConfigured } from "../../_lib/jira-config";
import { isLinearConfigured } from "../../_lib/linear-config";
import { isMicrosoftConfigured } from "../../_lib/microsoft-config";
import { isQuickBooksConfigured } from "../../_lib/quickbooks-config";
import { isSalesforceConfigured } from "../../_lib/salesforce-config";
import { isSlackConfigured } from "../../_lib/slack-config";
import { isStripeConfigured } from "../../_lib/stripe-config";
import { isXeroConfigured } from "../../_lib/xero-config";
import { isZendeskConfigured } from "../../_lib/zendesk-config";
import { AsanaConnectButton } from "./asana-connect-button";
import { AsanaDisconnectButton } from "./asana-disconnect-button";
import { AsanaSyncButton } from "./asana-sync-button";
import { GmailConnectButton } from "./gmail-connect-button";
import { GmailDisconnectButton } from "./gmail-disconnect-button";
import { GmailSyncButton } from "./gmail-sync-button";
import { GoogleCalendarConnectButton } from "./google-calendar-connect-button";
import { GoogleCalendarDisconnectButton } from "./google-calendar-disconnect-button";
import { HubSpotConnectButton } from "./hubspot-connect-button";
import { HubSpotDisconnectButton } from "./hubspot-disconnect-button";
import { HubSpotSyncButton } from "./hubspot-sync-button";
import { JiraConnectButton } from "./jira-connect-button";
import { JiraDisconnectButton } from "./jira-disconnect-button";
import { JiraSyncButton } from "./jira-sync-button";
import { LinearConnectButton } from "./linear-connect-button";
import { LinearDisconnectButton } from "./linear-disconnect-button";
import { MicrosoftCalendarConnectButton } from "./microsoft-calendar-connect-button";
import { MicrosoftCalendarDisconnectButton } from "./microsoft-calendar-disconnect-button";
import { MicrosoftOutlookConnectButton } from "./microsoft-outlook-connect-button";
import { MicrosoftOutlookDisconnectButton } from "./microsoft-outlook-disconnect-button";
import { QuickBooksConnectButton } from "./quickbooks-connect-button";
import { QuickBooksDisconnectButton } from "./quickbooks-disconnect-button";
import { QuickBooksSyncButton } from "./quickbooks-sync-button";
import { SalesforceConnectButton } from "./salesforce-connect-button";
import { SalesforceDisconnectButton } from "./salesforce-disconnect-button";
import { SalesforceSyncButton } from "./salesforce-sync-button";
import { SlackConnectButton } from "./slack-connect-button";
import { SlackDisconnectButton } from "./slack-disconnect-button";
import { StripeConnectButton } from "./stripe-connect-button";
import { StripeDisconnectButton } from "./stripe-disconnect-button";
import { XeroConnectButton } from "./xero-connect-button";
import { XeroDisconnectButton } from "./xero-disconnect-button";
import { XeroSyncButton } from "./xero-sync-button";
import { ZendeskConnectButton } from "./zendesk-connect-button";
import { ZendeskDisconnectButton } from "./zendesk-disconnect-button";
import { ZendeskSyncButton } from "./zendesk-sync-button";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

export interface IntegrationStatus {
  readonly id: string;
  readonly status: string;
  readonly externalAccountLabel: string | null;
}

/**
 * Everything the connector detail page needs to render a real OAuth
 * connector's "Connection status" panel and security note generically —
 * one entry per connector with real code, keyed by catalog slug, instead
 * of an `isHubSpot ? ... : ...` conditional that would only grow messier
 * with a third connector. A connector with no entry here (everything
 * still "planned") falls back to the page's own honest "Setup is
 * intentionally unavailable" copy.
 */
export interface OAuthConnectorAdapter {
  readonly providerLabel: string;
  isConfigured(): boolean;
  getStatus(organizationId: string): Promise<IntegrationStatus | null>;
  readonly ConnectButton: ComponentType;
  readonly DisconnectButton: ComponentType;
  /** Only set for connectors with a real initial sync (HubSpot,
   * QuickBooks, Asana) — renders a real "Sync now" control that re-runs
   * the same sync a fresh connect performs, on demand. */
  readonly SyncButton?: ComponentType;
  readonly callbackPath: string;
  /** The `?<slug>=connected` etc. query param this connector's callback
   * route redirects back with — read directly off `searchParams` by the
   * page, matching the exact literal key each callback route uses. */
  readonly statusQueryParam: string;
  setupSteps(redirectUri: string): ReactNode;
  connectedDescription(accountLabel: string | null): ReactNode;
  readyToConnectDescription(): ReactNode;
  securityNoteHeading: string;
  securityNoteBody: ReactNode;
}

export const oauthConnectorAdapters: Record<string, OAuthConnectorAdapter> = {
  hubspot: {
    providerLabel: "HubSpot",
    isConfigured: isHubSpotConfigured,
    getStatus: (organizationId) =>
      getHubSpotIntegrationStatus(getPool(), organizationId),
    ConnectButton: HubSpotConnectButton,
    DisconnectButton: HubSpotDisconnectButton,
    SyncButton: HubSpotSyncButton,
    callbackPath: "/integrations/hubspot/callback",
    statusQueryParam: "hubspot",
    setupSteps: (redirectUri) => (
      <>
        <li>
          Create a free app at{" "}
          <a
            href="https://developers.hubspot.com/"
            target="_blank"
            rel="noreferrer"
          >
            developers.hubspot.com
          </a>
          .
        </li>
        <li>
          Under Auth, add this exact redirect URL:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Copy the app&rsquo;s Client ID and Client Secret into{" "}
          <code>apps/web/.env.local</code> as <code>HUBSPOT_CLIENT_ID</code> and{" "}
          <code>HUBSPOT_CLIENT_SECRET</code>.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: () => (
      <>
        Your workspace has a real, authorized connection to HubSpot. Deals sync
        on connect, and you can sync again any time — recurring/ background sync
        isn&rsquo;t built yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes HubSpot access for reading Deals and Owners and, once you
        explicitly approve one specific drafted note, logging it on a stalled
        deal. Nothing is logged automatically, and no deal field (stage, amount,
        owner) is ever changed.
      </>
    ),
    securityNoteHeading: "Real, bounded, and approval-gated.",
    securityNoteBody: (
      <>
        This is a real OAuth flow (ADR 0008), scoped to read-only access to
        Deals and Owners plus <code>crm.objects.contacts.write</code> for
        logging a note — verified against HubSpot&rsquo;s own Notes API
        documentation, not the deal-write scope one might expect (HubSpot
        requires this scope for the Notes object specifically, regardless of
        which record type the note is attached to). Tokens are encrypted at rest
        via Supabase Vault and never handed to any code outside the functions
        that store and retrieve them. Logging is real but strictly bounded: an
        agent may only draft a note for one specific stalled deal for your
        review, and nothing is ever logged until you explicitly approve that
        exact draft. A workspace connected before this write capability shipped
        needs to reconnect once to grant the new scope — HubSpot&rsquo;s own
        reauthorization behavior picks up a newly-selected scope automatically
        on reconnect, so no extra step beyond that is needed.
      </>
    ),
  },
  salesforce: {
    providerLabel: "Salesforce",
    isConfigured: isSalesforceConfigured,
    getStatus: (organizationId) =>
      getSalesforceIntegrationStatus(getPool(), organizationId),
    ConnectButton: SalesforceConnectButton,
    DisconnectButton: SalesforceDisconnectButton,
    SyncButton: SalesforceSyncButton,
    callbackPath: "/integrations/salesforce/callback",
    statusQueryParam: "salesforce",
    setupSteps: (redirectUri) => (
      <>
        <li>
          Create a Connected App in Salesforce Setup (Setup → App Manager → New
          Connected App), with OAuth enabled.
        </li>
        <li>
          Under API (Enable OAuth Settings), add this exact callback URL:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Selected OAuth scopes must include <code>api</code> and{" "}
          <code>refresh_token</code>.
        </li>
        <li>
          Copy the Connected App&rsquo;s Consumer Key and Consumer Secret into{" "}
          <code>apps/web/.env.local</code> as <code>SALESFORCE_CLIENT_ID</code>{" "}
          and <code>SALESFORCE_CLIENT_SECRET</code>.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: () => (
      <>
        Your workspace has a real, authorized connection to Salesforce.
        Opportunities sync on connect, and you can sync again any time —
        recurring/background sync isn&rsquo;t built yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes read access to Opportunities. No writes are made to your
        Salesforce org.
      </>
    ),
    securityNoteHeading: "Real, but scoped and read-only.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 web server flow. Tokens are encrypted at rest
        via Supabase Vault, scoped to read-only access to Opportunities, and
        never handed to any code outside the functions that store and retrieve
        them. No write, webhook, or scheduled sync exists yet.
      </>
    ),
  },
  slack: {
    providerLabel: "Slack",
    isConfigured: isSlackConfigured,
    getStatus: (organizationId) =>
      getSlackIntegrationStatus(getPool(), organizationId),
    ConnectButton: SlackConnectButton,
    DisconnectButton: SlackDisconnectButton,
    callbackPath: "/integrations/slack/callback",
    statusQueryParam: "slack",
    setupSteps: (redirectUri) => (
      <>
        <li>
          Create a free app at{" "}
          <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer">
            api.slack.com/apps
          </a>
          .
        </li>
        <li>
          Under OAuth &amp; Permissions, add this exact redirect URL:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Copy the app&rsquo;s Client ID and Client Secret into{" "}
          <code>apps/web/.env.local</code> as <code>SLACK_CLIENT_ID</code> and{" "}
          <code>SLACK_CLIENT_SECRET</code>.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: (accountLabel) => (
      <>
        Your workspace has a real, authorized connection to{" "}
        {accountLabel ? (
          <strong>{accountLabel}</strong>
        ) : (
          "your Slack workspace"
        )}
        . Read-only for now — no message posting or other write action exists
        yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>Authorizes read access to public channel names. Nothing is posted.</>
    ),
    securityNoteHeading: "Real, but read-only.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 flow. The bot token is encrypted at rest via
        Supabase Vault and never handed to any code outside the functions that
        store and retrieve it. No message posting, channel history, or scheduled
        sync exists yet — connecting only proves the authorization mechanism and
        marks this connector genuinely connected in Business Coverage.
      </>
    ),
  },
  stripe: {
    providerLabel: "Stripe",
    isConfigured: isStripeConfigured,
    getStatus: (organizationId) =>
      getStripeIntegrationStatus(getPool(), organizationId),
    ConnectButton: StripeConnectButton,
    DisconnectButton: StripeDisconnectButton,
    callbackPath: "/integrations/stripe/callback",
    statusQueryParam: "stripe",
    setupSteps: (redirectUri) => (
      <>
        <li>
          Enable OAuth onboarding at{" "}
          <a
            href="https://dashboard.stripe.com/settings/connect/onboarding-options/oauth"
            target="_blank"
            rel="noreferrer"
          >
            your Connect OAuth settings
          </a>
          .
        </li>
        <li>
          Add this exact redirect URL:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Copy the app&rsquo;s Client ID and your account&rsquo;s secret key
          into <code>apps/web/.env.local</code> as <code>STRIPE_CLIENT_ID</code>{" "}
          and <code>STRIPE_SECRET_KEY</code>. Stripe has no separate client
          secret — the secret key doubles as the OAuth credential.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: (accountLabel) => (
      <>
        This workspace has a real, authorized connection to{" "}
        {accountLabel ? <strong>{accountLabel}</strong> : "a Stripe account"}.
        Read-only for now — no payment or account data is fetched yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes read-only access to one Stripe account. No charges, payouts,
        or account settings can be changed.
      </>
    ),
    securityNoteHeading: "Real, but read-only.",
    securityNoteBody: (
      <>
        This is a real Stripe Connect OAuth flow, requested at the{" "}
        <code>read_only</code> scope. Per Stripe&rsquo;s own current guidance,
        no bearer token is stored at all — only the connected account id — since
        API calls authenticate with this platform&rsquo;s own secret key
        instead. No payment data is fetched yet; connecting only proves the
        authorization mechanism and marks this connector genuinely connected in
        Business Coverage.
      </>
    ),
  },
  quickbooks: {
    providerLabel: "QuickBooks",
    isConfigured: isQuickBooksConfigured,
    getStatus: (organizationId) =>
      getQuickBooksIntegrationStatus(getPool(), organizationId),
    ConnectButton: QuickBooksConnectButton,
    DisconnectButton: QuickBooksDisconnectButton,
    SyncButton: QuickBooksSyncButton,
    callbackPath: "/integrations/quickbooks/callback",
    statusQueryParam: "quickbooks",
    setupSteps: (redirectUri) => (
      <>
        <li>
          Create a free app at{" "}
          <a
            href="https://developer.intuit.com/"
            target="_blank"
            rel="noreferrer"
          >
            developer.intuit.com
          </a>
          .
        </li>
        <li>
          Under Keys &amp; OAuth, add this exact redirect URL:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Copy the app&rsquo;s Client ID and Client Secret into{" "}
          <code>apps/web/.env.local</code> as <code>QUICKBOOKS_CLIENT_ID</code>{" "}
          and <code>QUICKBOOKS_CLIENT_SECRET</code>.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: () => (
      <>
        This workspace has a real, authorized connection to a QuickBooks Online
        company. Overdue invoices sync on connect, and you can sync again any
        time — read-only, and recurring/background sync isn&rsquo;t built yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        QuickBooks&rsquo; own OAuth scope grants full API access — this app
        reads invoices and payments, and, once you explicitly approve one
        specific drafted reminder, sends a payment-reminder email for one
        overdue invoice. Nothing is sent automatically, and no other invoice
        field, payment, or company setting is ever changed.
      </>
    ),
    securityNoteHeading: "Real, bounded, and approval-gated.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 flow. Tokens are encrypted at rest via Supabase
        Vault and never handed to any code outside the functions that store and
        retrieve them. QuickBooks Online has no read-only OAuth scope to
        request, and the same coarse scope already covers this write — no
        reconnect is needed to gain it. Overdue invoices sync on connect and you
        can re-sync any time — no webhook or background-polling sync exists yet.
        Sending is real but strictly bounded: an agent may only draft a reminder
        for one specific overdue invoice for your review, and nothing is ever
        sent until you explicitly approve that exact draft. QuickBooks&rsquo;
        own send endpoint accepts no custom message text, so approving a draft
        sets it as the invoice&rsquo;s customer- visible memo immediately before
        sending — the one invoice field this action ever touches.
      </>
    ),
  },
  xero: {
    providerLabel: "Xero",
    isConfigured: isXeroConfigured,
    getStatus: (organizationId) =>
      getXeroIntegrationStatus(getPool(), organizationId),
    ConnectButton: XeroConnectButton,
    DisconnectButton: XeroDisconnectButton,
    SyncButton: XeroSyncButton,
    callbackPath: "/integrations/xero/callback",
    statusQueryParam: "xero",
    setupSteps: (redirectUri) => (
      <>
        <li>
          Create a free app at{" "}
          <a
            href="https://developer.xero.com/app/manage"
            target="_blank"
            rel="noreferrer"
          >
            developer.xero.com
          </a>
          .
        </li>
        <li>
          Under Configuration, add this exact redirect URL:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Copy the app&rsquo;s Client ID and Client Secret into{" "}
          <code>apps/web/.env.local</code> as <code>XERO_CLIENT_ID</code> and{" "}
          <code>XERO_CLIENT_SECRET</code>.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: (accountLabel) => (
      <>
        This workspace has a real, authorized connection to{" "}
        {accountLabel ? (
          <strong>{accountLabel}</strong>
        ) : (
          "your Xero organisation"
        )}
        . Open invoices sync on connect, and you can sync again any time —
        read-only, and recurring/background sync isn&rsquo;t built yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes read access to Invoices. No writes are made to your Xero
        organisation.
      </>
    ),
    securityNoteHeading: "Real, but scoped and read-only.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 flow, requested at the{" "}
        <code>accounting.transactions.read</code> scope. Tokens are encrypted at
        rest via Supabase Vault and never handed to any code outside the
        functions that store and retrieve them. No write, webhook, or scheduled
        sync exists yet — connecting only proves the authorization mechanism and
        marks this connector genuinely connected in Business Coverage.
      </>
    ),
  },
  gmail: {
    providerLabel: "Gmail",
    isConfigured: isGoogleConfigured,
    getStatus: (organizationId) =>
      getGmailIntegrationStatus(getPool(), organizationId),
    ConnectButton: GmailConnectButton,
    DisconnectButton: GmailDisconnectButton,
    SyncButton: GmailSyncButton,
    callbackPath: "/integrations/gmail/callback",
    statusQueryParam: "gmail",
    setupSteps: (redirectUri) => (
      <>
        <li>
          Create an OAuth client at{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
          >
            Google Cloud Console
          </a>{" "}
          and enable the Gmail API.
        </li>
        <li>
          Under Authorized redirect URIs, add this exact URL:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Copy the client&rsquo;s Client ID and Client Secret into{" "}
          <code>apps/web/.env.local</code> as <code>GOOGLE_CLIENT_ID</code> and{" "}
          <code>GOOGLE_CLIENT_SECRET</code>. Google Calendar shares this same
          client — only the redirect URI and requested scope differ.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: (accountLabel) => (
      <>
        This workspace has a real, authorized connection to{" "}
        {accountLabel ? <strong>{accountLabel}</strong> : "a Google account"}.
        Recent external messages (last 30 days, purely internal correspondence
        excluded) sync on connect, and you can sync again any time — read-only,
        and recurring/background sync isn&rsquo;t built yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes Gmail access for reading messages and, once you explicitly
        approve one specific drafted reply, sending it. Nothing is sent
        automatically, and nothing is deleted or modified.
      </>
    ),
    securityNoteHeading: "Real, bounded, and approval-gated.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 flow, requested at the read-only Gmail scope
        plus a send-only scope (never <code>gmail.modify</code>, which would
        also grant delete/modify access) and the minimal identity scope needed
        to know which Google account connected. Tokens are encrypted at rest via
        Supabase Vault and never handed to any code outside the functions that
        store and retrieve them. Sync is deliberately bounded — only recent
        (last 30 days), genuinely external messages are ingested, each message
        body is hard-truncated to 5,000 characters, and only a short preview
        (never the full body) ever appears on a card or reaches an AI
        interpretation call. No field-level encryption beyond this
        workspace&rsquo;s ordinary tenant isolation protects stored message
        content — see docs/adr/0050-gmail-message-ingestion.md for the full,
        honest accounting of what is and isn&rsquo;t protected. Sending is real
        but strictly bounded: an agent may only draft a reply to one specific
        unanswered message for your review, and nothing is ever sent until you
        explicitly approve that exact draft — see
        docs/adr/0056-message-reply-send.md for what&rsquo;s verified and
        what&rsquo;s still not built (no scheduled or background sending
        exists).
      </>
    ),
  },
  "google-calendar": {
    providerLabel: "Google Calendar",
    isConfigured: isGoogleConfigured,
    getStatus: (organizationId) =>
      getGoogleCalendarIntegrationStatus(getPool(), organizationId),
    ConnectButton: GoogleCalendarConnectButton,
    DisconnectButton: GoogleCalendarDisconnectButton,
    callbackPath: "/integrations/google-calendar/callback",
    statusQueryParam: "google-calendar",
    setupSteps: (redirectUri) => (
      <>
        <li>
          Create an OAuth client at{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
          >
            Google Cloud Console
          </a>{" "}
          and enable the Google Calendar API.
        </li>
        <li>
          Under Authorized redirect URIs, add this exact URL:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Copy the client&rsquo;s Client ID and Client Secret into{" "}
          <code>apps/web/.env.local</code> as <code>GOOGLE_CLIENT_ID</code> and{" "}
          <code>GOOGLE_CLIENT_SECRET</code>. Gmail shares this same client —
          only the redirect URI and requested scope differ.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: (accountLabel) => (
      <>
        This workspace has a real, authorized connection to{" "}
        {accountLabel ? <strong>{accountLabel}</strong> : "a Google account"}.
        Read-only for now — no schedule data is fetched yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes read-only access to Google Calendar. No events are created,
        changed, or deleted.
      </>
    ),
    securityNoteHeading: "Real, but read-only.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 flow, requested at the read-only Calendar scope
        only (plus the minimal identity scope needed to know which Google
        account connected). Tokens are encrypted at rest via Supabase Vault and
        never handed to any code outside the functions that store and retrieve
        them. No schedule reading, writing, or scheduled sync exists yet —
        connecting only proves the authorization mechanism and marks this
        connector genuinely connected in Business Coverage.
      </>
    ),
  },
  "microsoft-outlook": {
    providerLabel: "Outlook",
    isConfigured: isMicrosoftConfigured,
    getStatus: (organizationId) =>
      getMicrosoftOutlookIntegrationStatus(getPool(), organizationId),
    ConnectButton: MicrosoftOutlookConnectButton,
    DisconnectButton: MicrosoftOutlookDisconnectButton,
    callbackPath: "/integrations/microsoft-outlook/callback",
    statusQueryParam: "microsoft-outlook",
    setupSteps: (redirectUri) => (
      <>
        <li>
          Register an app at{" "}
          <a
            href="https://entra.microsoft.com/"
            target="_blank"
            rel="noreferrer"
          >
            entra.microsoft.com
          </a>{" "}
          (App registrations) and grant it the Mail.Read Graph permission.
        </li>
        <li>
          Under Authentication, add this exact redirect URI:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Copy the app&rsquo;s Application (client) ID and a client secret into{" "}
          <code>apps/web/.env.local</code> as <code>MICROSOFT_CLIENT_ID</code>{" "}
          and <code>MICROSOFT_CLIENT_SECRET</code>. Microsoft Calendar shares
          this same app — only the redirect URI and requested scope differ.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: (accountLabel) => (
      <>
        This workspace has a real, authorized connection to{" "}
        {accountLabel ? <strong>{accountLabel}</strong> : "a Microsoft account"}
        . Read-only for now — no email data is fetched yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes read-only access to Outlook mail. No messages are sent, and
        nothing is deleted or modified.
      </>
    ),
    securityNoteHeading: "Real, but read-only.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 flow using PKCE, requested at the read-only
        Mail scope only (plus the minimal identity scopes needed to know which
        Microsoft account connected). Tokens are encrypted at rest via Supabase
        Vault. Disconnecting here deletes them locally — Microsoft has no revoke
        API for third-party apps to call for one specific connection, so to
        remove this app&rsquo;s access on Microsoft&rsquo;s own side too, visit{" "}
        <a
          href="https://myapps.microsoft.com/"
          target="_blank"
          rel="noreferrer"
        >
          myapps.microsoft.com
        </a>
        . No message reading, sending, or scheduled sync exists yet.
      </>
    ),
  },
  "microsoft-calendar": {
    providerLabel: "Microsoft Calendar",
    isConfigured: isMicrosoftConfigured,
    getStatus: (organizationId) =>
      getMicrosoftCalendarIntegrationStatus(getPool(), organizationId),
    ConnectButton: MicrosoftCalendarConnectButton,
    DisconnectButton: MicrosoftCalendarDisconnectButton,
    callbackPath: "/integrations/microsoft-calendar/callback",
    statusQueryParam: "microsoft-calendar",
    setupSteps: (redirectUri) => (
      <>
        <li>
          Register an app at{" "}
          <a
            href="https://entra.microsoft.com/"
            target="_blank"
            rel="noreferrer"
          >
            entra.microsoft.com
          </a>{" "}
          (App registrations) and grant it the Calendars.Read Graph permission.
        </li>
        <li>
          Under Authentication, add this exact redirect URI:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Copy the app&rsquo;s Application (client) ID and a client secret into{" "}
          <code>apps/web/.env.local</code> as <code>MICROSOFT_CLIENT_ID</code>{" "}
          and <code>MICROSOFT_CLIENT_SECRET</code>. Outlook shares this same app
          — only the redirect URI and requested scope differ.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: (accountLabel) => (
      <>
        This workspace has a real, authorized connection to{" "}
        {accountLabel ? <strong>{accountLabel}</strong> : "a Microsoft account"}
        . Read-only for now — no schedule data is fetched yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes read-only access to Microsoft Calendar. No events are
        created, changed, or deleted.
      </>
    ),
    securityNoteHeading: "Real, but read-only.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 flow using PKCE, requested at the read-only
        Calendars scope only (plus the minimal identity scopes needed to know
        which Microsoft account connected). Tokens are encrypted at rest via
        Supabase Vault. Disconnecting here deletes them locally — Microsoft has
        no revoke API for third-party apps to call for one specific connection,
        so to remove this app&rsquo;s access on Microsoft&rsquo;s own side too,
        visit{" "}
        <a
          href="https://myapps.microsoft.com/"
          target="_blank"
          rel="noreferrer"
        >
          myapps.microsoft.com
        </a>
        . No schedule reading, writing, or scheduled sync exists yet.
      </>
    ),
  },
  asana: {
    providerLabel: "Asana",
    isConfigured: isAsanaConfigured,
    getStatus: (organizationId) =>
      getAsanaIntegrationStatus(getPool(), organizationId),
    ConnectButton: AsanaConnectButton,
    DisconnectButton: AsanaDisconnectButton,
    SyncButton: AsanaSyncButton,
    callbackPath: "/integrations/asana/callback",
    statusQueryParam: "asana",
    setupSteps: (redirectUri) => (
      <>
        <li>
          Create an app at{" "}
          <a
            href="https://app.asana.com/0/developer-console"
            target="_blank"
            rel="noreferrer"
          >
            Asana&rsquo;s developer console
          </a>
          .
        </li>
        <li>
          Under OAuth, add this exact redirect URL:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Copy the app&rsquo;s Client ID and Client Secret into{" "}
          <code>apps/web/.env.local</code> as <code>ASANA_CLIENT_ID</code> and{" "}
          <code>ASANA_CLIENT_SECRET</code>.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: (accountLabel) => (
      <>
        This workspace has a real, authorized connection to{" "}
        {accountLabel ? <strong>{accountLabel}</strong> : "an Asana account"}.
        Overdue tasks sync on connect, and you can sync again any time —
        read-only, and recurring/background sync isn&rsquo;t built yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes Asana access for reading tasks and, once you explicitly
        approve one specific drafted nudge, posting it as a comment. Nothing is
        posted automatically, and no task field (due date, assignee, completion)
        is ever changed.
      </>
    ),
    securityNoteHeading: "Real, bounded, and approval-gated.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 flow, requested at the narrowest read scopes
        that cover projects and tasks, plus a send-only <code>tasks:write</code>{" "}
        scope for posting one comment — never a scope that would let this app
        change a task&rsquo;s due date, assignee, or completion state. Tokens
        are encrypted at rest via Supabase Vault and never handed to any code
        outside the functions that store and retrieve them. Overdue tasks sync
        on connect and you can re-sync any time — no webhook or
        background-polling sync exists yet. Posting is real but strictly
        bounded: an agent may only draft a follow-up comment for one specific
        overdue task for your review, and nothing is ever posted until you
        explicitly approve that exact draft. A workspace connected before this
        write capability shipped needs to disconnect and reconnect once to grant
        the new scope — Asana&rsquo;s own authorize screen re-prompts by default
        on a fresh connection, so no extra step beyond that is needed.
      </>
    ),
  },
  jira: {
    providerLabel: "Jira",
    isConfigured: isJiraConfigured,
    getStatus: (organizationId) =>
      getJiraIntegrationStatus(getPool(), organizationId),
    ConnectButton: JiraConnectButton,
    DisconnectButton: JiraDisconnectButton,
    SyncButton: JiraSyncButton,
    callbackPath: "/integrations/jira/callback",
    statusQueryParam: "jira",
    setupSteps: (redirectUri) => (
      <>
        <li>
          Create an OAuth 2.0 (3LO) app at{" "}
          <a
            href="https://developer.atlassian.com/console/myapps/"
            target="_blank"
            rel="noreferrer"
          >
            Atlassian&rsquo;s developer console
          </a>
          .
        </li>
        <li>
          Under Authorization, add this exact callback URL:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Selected scopes must include <code>read:jira-work</code> and{" "}
          <code>offline_access</code>.
        </li>
        <li>
          Copy the app&rsquo;s Client ID and Client Secret into{" "}
          <code>apps/web/.env.local</code> as <code>JIRA_CLIENT_ID</code> and{" "}
          <code>JIRA_CLIENT_SECRET</code>.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: (accountLabel) => (
      <>
        This workspace has a real, authorized connection to{" "}
        {accountLabel ? <strong>{accountLabel}</strong> : "your Jira site"}.
        Open issues sync on connect, and you can sync again any time —
        read-only, and recurring/background sync isn&rsquo;t built yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes read access to issues. No writes are made to your Jira site.
      </>
    ),
    securityNoteHeading: "Real, but scoped and read-only.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 (3LO) flow, requested at the{" "}
        <code>read:jira-work</code> scope. Tokens are encrypted at rest via
        Supabase Vault and never handed to any code outside the functions that
        store and retrieve them. Atlassian has no programmatic revoke endpoint
        for this grant type — disconnecting here deletes the stored tokens, but
        fully revoking access requires the user&rsquo;s own Atlassian account
        settings. No write, webhook, or scheduled sync exists yet — connecting
        only proves the authorization mechanism and marks this connector
        genuinely connected in Business Coverage.
      </>
    ),
  },
  zendesk: {
    providerLabel: "Zendesk",
    isConfigured: isZendeskConfigured,
    getStatus: (organizationId) =>
      getZendeskIntegrationStatus(getPool(), organizationId),
    ConnectButton: ZendeskConnectButton,
    DisconnectButton: ZendeskDisconnectButton,
    SyncButton: ZendeskSyncButton,
    callbackPath: "/integrations/zendesk/callback",
    statusQueryParam: "zendesk",
    setupSteps: (redirectUri) => (
      <>
        <li>
          In your Zendesk account, go to Admin Center → Apps and integrations →
          APIs → Zendesk API, and add a real OAuth client.
        </li>
        <li>
          Under Redirect URLs, add this exact callback URL:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Selected scopes must include <code>read</code> and <code>write</code>.
        </li>
        <li>
          Copy the client&rsquo;s Unique Identifier and Secret into{" "}
          <code>apps/web/.env.local</code> as <code>ZENDESK_CLIENT_ID</code> and{" "}
          <code>ZENDESK_CLIENT_SECRET</code>.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: (accountLabel) => (
      <>
        This workspace has a real, authorized connection to{" "}
        {accountLabel ? (
          <strong>{accountLabel}</strong>
        ) : (
          "your Zendesk account"
        )}
        . Open tickets sync on connect, and you can sync again any time —
        read-only, and recurring/background sync isn&rsquo;t built yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes Zendesk access for reading tickets (including recent
        comments, read live at draft time, never stored) and, once you
        explicitly approve one specific drafted reply, posting it as a ticket
        comment. Nothing is posted automatically, and no ticket field (status,
        priority, assignee) is ever changed. Unlike every other connector here,
        you&rsquo;ll need to enter your Zendesk subdomain before continuing —
        every Zendesk account lives at its own{" "}
        <code>{"{subdomain}"}.zendesk.com</code> address, and the authorization
        flow needs it from the start.
      </>
    ),
    securityNoteHeading: "Real, bounded, and approval-gated.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 flow, requested at the <code>read</code> and{" "}
        <code>write</code> scopes (Zendesk&rsquo;s OAuth model is account-wide,
        not per-resource — there is no narrower scope that covers only replying
        to tickets). Tokens are encrypted at rest via Supabase Vault and never
        handed to any code outside the functions that store and retrieve them.
        Unlike Jira, Zendesk has a genuine, working revoke endpoint —
        disconnecting here both deletes the stored tokens and revokes the grant
        on Zendesk&rsquo;s side. Posting is real but strictly bounded: an agent
        may only draft a reply to one specific stuck ticket for your review,
        grounded in a live read of that ticket&rsquo;s own recent comments
        (never stored, never reaching any other part of this app), and nothing
        is ever posted until you explicitly approve that exact draft. A
        workspace connected before this write capability shipped needs to
        reconnect once to grant the new scope — Zendesk&rsquo;s own OAuth
        behavior re-prompts automatically whenever a reconnect requests a scope
        the existing grant doesn&rsquo;t already have, confirmed against
        Zendesk&rsquo;s current OAuth documentation, so no extra step beyond a
        plain reconnect is needed.
      </>
    ),
  },
  linear: {
    providerLabel: "Linear",
    isConfigured: isLinearConfigured,
    getStatus: (organizationId) =>
      getLinearIntegrationStatus(getPool(), organizationId),
    ConnectButton: LinearConnectButton,
    DisconnectButton: LinearDisconnectButton,
    callbackPath: "/integrations/linear/callback",
    statusQueryParam: "linear",
    setupSteps: (redirectUri) => (
      <>
        <li>
          Create an OAuth application at{" "}
          <a
            href="https://linear.app/settings/api/applications/new"
            target="_blank"
            rel="noreferrer"
          >
            linear.app/settings/api
          </a>
          .
        </li>
        <li>
          Add this exact redirect URL:
          <code className="setupRedirectUri">{redirectUri}</code>
        </li>
        <li>
          Copy the app&rsquo;s Client ID and Client Secret into{" "}
          <code>apps/web/.env.local</code> as <code>LINEAR_CLIENT_ID</code> and{" "}
          <code>LINEAR_CLIENT_SECRET</code>.
        </li>
        <li>Restart the dev server.</li>
      </>
    ),
    connectedDescription: (accountLabel) => (
      <>
        This workspace has a real, authorized connection to{" "}
        {accountLabel ? <strong>{accountLabel}</strong> : "a Linear account"}.
        Read-only for now — no issue or project data is fetched yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes read-only access to issues and projects. No issue changes are
        made.
      </>
    ),
    securityNoteHeading: "Real, but read-only.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 flow, requested at Linear&rsquo;s read-only
        scope. Tokens are encrypted at rest via Supabase Vault and never handed
        to any code outside the functions that store and retrieve them. No issue
        reading, writing, or scheduled sync exists yet — connecting only proves
        the authorization mechanism and marks this connector genuinely connected
        in Business Coverage.
      </>
    ),
  },
};
