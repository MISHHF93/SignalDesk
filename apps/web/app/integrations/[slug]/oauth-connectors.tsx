import type { ComponentType, ReactNode } from "react";

import {
  createDatabasePool,
  getAsanaIntegrationStatus,
  getGmailIntegrationStatus,
  getGoogleCalendarIntegrationStatus,
  getHubSpotIntegrationStatus,
  getLinearIntegrationStatus,
  getMicrosoftCalendarIntegrationStatus,
  getMicrosoftOutlookIntegrationStatus,
  getQuickBooksIntegrationStatus,
  getSlackIntegrationStatus,
  getStripeIntegrationStatus,
} from "@signaldesk/persistence";

import { isAsanaConfigured } from "../../_lib/asana-config";
import { isGoogleConfigured } from "../../_lib/google-config";
import { isHubSpotConfigured } from "../../_lib/hubspot-config";
import { isLinearConfigured } from "../../_lib/linear-config";
import { isMicrosoftConfigured } from "../../_lib/microsoft-config";
import { isQuickBooksConfigured } from "../../_lib/quickbooks-config";
import { isSlackConfigured } from "../../_lib/slack-config";
import { isStripeConfigured } from "../../_lib/stripe-config";
import { AsanaConnectButton } from "./asana-connect-button";
import { AsanaDisconnectButton } from "./asana-disconnect-button";
import { GmailConnectButton } from "./gmail-connect-button";
import { GmailDisconnectButton } from "./gmail-disconnect-button";
import { GoogleCalendarConnectButton } from "./google-calendar-connect-button";
import { GoogleCalendarDisconnectButton } from "./google-calendar-disconnect-button";
import { HubSpotConnectButton } from "./hubspot-connect-button";
import { HubSpotDisconnectButton } from "./hubspot-disconnect-button";
import { LinearConnectButton } from "./linear-connect-button";
import { LinearDisconnectButton } from "./linear-disconnect-button";
import { MicrosoftCalendarConnectButton } from "./microsoft-calendar-connect-button";
import { MicrosoftCalendarDisconnectButton } from "./microsoft-calendar-disconnect-button";
import { MicrosoftOutlookConnectButton } from "./microsoft-outlook-connect-button";
import { MicrosoftOutlookDisconnectButton } from "./microsoft-outlook-disconnect-button";
import { QuickBooksConnectButton } from "./quickbooks-connect-button";
import { QuickBooksDisconnectButton } from "./quickbooks-disconnect-button";
import { SlackConnectButton } from "./slack-connect-button";
import { SlackDisconnectButton } from "./slack-disconnect-button";
import { StripeConnectButton } from "./stripe-connect-button";
import { StripeDisconnectButton } from "./stripe-disconnect-button";

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
        once on connect; recurring sync isn&rsquo;t built yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes read access to Deals and Owners. No writes are made to your
        HubSpot account.
      </>
    ),
    securityNoteHeading: "Real, but scoped and read-only.",
    securityNoteBody: (
      <>
        This is a real OAuth flow (ADR 0008). Tokens are encrypted at rest via
        Supabase Vault, scoped to read-only access to Deals and Owners, and
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
        company. Read-only for now — no accounting data is fetched yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        QuickBooks&rsquo; own OAuth scope grants full API access — this app only
        ever makes read requests. No invoices, payments, or company settings can
        be changed.
      </>
    ),
    securityNoteHeading: "Real, but read-only by choice.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 flow. Tokens are encrypted at rest via Supabase
        Vault and never handed to any code outside the functions that store and
        retrieve them. QuickBooks Online has no read-only OAuth scope to
        request, so read-only is enforced by which endpoints this app calls, not
        by what it asked Intuit for. No accounting data, webhook, or scheduled
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
        Read-only for now — no email data is fetched yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes read-only access to Gmail. No messages are sent, and nothing
        is deleted or modified.
      </>
    ),
    securityNoteHeading: "Real, but read-only.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 flow, requested at the read-only Gmail scope
        only (plus the minimal identity scope needed to know which Google
        account connected). Tokens are encrypted at rest via Supabase Vault and
        never handed to any code outside the functions that store and retrieve
        them. No message reading, sending, or scheduled sync exists yet —
        connecting only proves the authorization mechanism and marks this
        connector genuinely connected in Business Coverage.
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
        Read-only for now — no project or task data is fetched yet.
      </>
    ),
    readyToConnectDescription: () => (
      <>
        Authorizes read-only access to projects and tasks. No task changes are
        made.
      </>
    ),
    securityNoteHeading: "Real, but read-only.",
    securityNoteBody: (
      <>
        This is a real OAuth 2.0 flow, requested at the narrowest read scopes
        that cover projects and tasks. Tokens are encrypted at rest via Supabase
        Vault and never handed to any code outside the functions that store and
        retrieve them. No task reading, writing, or scheduled sync exists yet —
        connecting only proves the authorization mechanism and marks this
        connector genuinely connected in Business Coverage.
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
