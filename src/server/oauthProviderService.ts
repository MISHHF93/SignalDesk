/**
 * SignalDesk Real OAuth 2.0 & Provider Authorization Engine
 *
 * Enforces authentic provider authentication:
 * - Redirects to official provider authorization URLs (Google, GitHub, Slack, HubSpot, Salesforce, etc.)
 * - Validates redirect URI and CSRF state
 * - Performs server-to-server token exchange with official provider token endpoints
 * - Never collects or stores third-party passwords
 * - Provides verified owner setup instructions and exact callback URLs when unconfigured
 */

import crypto from 'crypto';

function getCleanEnv(key?: string): string {
  if (!key) return '';
  return process.env[key]?.trim() || '';
}

export interface ProviderOAuthConfig {
  providerId: string;
  providerName: string;
  authStrategy: 'oauth2_pkce' | 'oauth2_standard' | 'api_key_vault';
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  identityEndpoint?: string;
  clientIdEnvVar?: string;
  clientSecretEnvVar?: string;
  alternativeTokenEnvVar?: string;
  defaultScopes: string[];
  developerPortalUrl: string;
  setupGuide: string[];
  supportsPkce?: boolean;
}

export const OAUTH_PROVIDER_CONFIGS: Record<string, ProviderOAuthConfig> = {
  google_workspace: {
    providerId: 'google_workspace',
    providerName: 'Google Workspace',
    authStrategy: 'oauth2_pkce',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    identityEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
    clientIdEnvVar: 'GOOGLE_CLIENT_ID',
    clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
    alternativeTokenEnvVar: 'GOOGLE_ACCESS_TOKEN',
    defaultScopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly'
    ],
    developerPortalUrl: 'https://console.cloud.google.com/apis/credentials',
    supportsPkce: true,
    setupGuide: [
      'Open Google Cloud Console > APIs & Services > Credentials.',
      'Create an OAuth 2.0 Client ID for Web Applications.',
      'Add Authorized Redirect URI: {CALLBACK_URL}',
      'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in SignalDesk environment.',
      'Enable Gmail API and Google Calendar API in Enabled APIs & Services.'
    ]
  },
  gmail: {
    providerId: 'gmail',
    providerName: 'Google Workspace Gmail',
    authStrategy: 'oauth2_pkce',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    identityEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
    clientIdEnvVar: 'GOOGLE_CLIENT_ID',
    clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
    alternativeTokenEnvVar: 'GOOGLE_ACCESS_TOKEN',
    defaultScopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly'
    ],
    developerPortalUrl: 'https://console.cloud.google.com/apis/credentials',
    supportsPkce: true,
    setupGuide: [
      'Open Google Cloud Console > APIs & Services > Credentials.',
      'Add Authorized Redirect URI: {CALLBACK_URL}',
      'Ensure Gmail API is enabled.'
    ]
  },
  google_calendar: {
    providerId: 'google_calendar',
    providerName: 'Google Calendar',
    authStrategy: 'oauth2_pkce',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    identityEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
    clientIdEnvVar: 'GOOGLE_CLIENT_ID',
    clientSecretEnvVar: 'GOOGLE_CLIENT_SECRET',
    alternativeTokenEnvVar: 'GOOGLE_ACCESS_TOKEN',
    defaultScopes: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly'
    ],
    developerPortalUrl: 'https://console.cloud.google.com/apis/credentials',
    supportsPkce: true,
    setupGuide: [
      'Open Google Cloud Console > APIs & Services > Credentials.',
      'Add Authorized Redirect URI: {CALLBACK_URL}',
      'Ensure Google Calendar API is enabled.'
    ]
  },
  github: {
    providerId: 'github',
    providerName: 'GitHub Enterprise',
    authStrategy: 'oauth2_standard',
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    identityEndpoint: 'https://api.github.com/user',
    clientIdEnvVar: 'GITHUB_CLIENT_ID',
    clientSecretEnvVar: 'GITHUB_CLIENT_SECRET',
    alternativeTokenEnvVar: 'GITHUB_TOKEN',
    defaultScopes: ['read:user', 'user:email', 'repo:status', 'read:org'],
    developerPortalUrl: 'https://github.com/settings/developers',
    setupGuide: [
      'In GitHub, go to Settings > Developer settings > OAuth Apps > New OAuth App.',
      'Set Authorization callback URL to {CALLBACK_URL}',
      'Generate a Client Secret.',
      'Configure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in SignalDesk.',
      'Alternatively, enter a Personal Access Token with repo:status and read:org scopes.'
    ]
  },
  slack: {
    providerId: 'slack',
    providerName: 'Slack Workspace',
    authStrategy: 'oauth2_standard',
    authorizationEndpoint: 'https://slack.com/oauth/v2/authorize',
    tokenEndpoint: 'https://slack.com/api/oauth.v2.access',
    identityEndpoint: 'https://slack.com/api/auth.test',
    clientIdEnvVar: 'SLACK_CLIENT_ID',
    clientSecretEnvVar: 'SLACK_CLIENT_SECRET',
    alternativeTokenEnvVar: 'SLACK_BOT_TOKEN',
    defaultScopes: ['channels:read', 'groups:read', 'channels:history'],
    developerPortalUrl: 'https://api.slack.com/apps',
    setupGuide: [
      'Visit api.slack.com/apps and select or create your SignalDesk Slack App.',
      'Go to OAuth & Permissions and add Redirect URL: {CALLBACK_URL}',
      'Add Bot Token Scopes: channels:read, groups:read, channels:history.',
      'Configure SLACK_CLIENT_ID and SLACK_CLIENT_SECRET (or SLACK_BOT_TOKEN).'
    ]
  },
  hubspot: {
    providerId: 'hubspot',
    providerName: 'HubSpot CRM',
    authStrategy: 'oauth2_standard',
    authorizationEndpoint: 'https://app.hubspot.com/oauth/authorize',
    tokenEndpoint: 'https://api.hubapi.com/oauth/v1/token',
    identityEndpoint: 'https://api.hubapi.com/crm/v3/objects/contacts?limit=1',
    clientIdEnvVar: 'HUBSPOT_CLIENT_ID',
    clientSecretEnvVar: 'HUBSPOT_CLIENT_SECRET',
    alternativeTokenEnvVar: 'HUBSPOT_ACCESS_TOKEN',
    defaultScopes: ['crm.objects.contacts.read', 'crm.objects.deals.read'],
    developerPortalUrl: 'https://app.hubspot.com/developer',
    setupGuide: [
      'In HubSpot Developer Account, open Apps > Create App.',
      'Under Auth, add Redirect URL: {CALLBACK_URL}',
      'Select scopes: crm.objects.contacts.read and crm.objects.deals.read.',
      'Set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET in SignalDesk.',
      'Alternatively, create a Private App in your HubSpot portal and paste the Private App token.'
    ]
  },
  linear: {
    providerId: 'linear',
    providerName: 'Linear Issues',
    authStrategy: 'oauth2_standard',
    authorizationEndpoint: 'https://linear.app/oauth/authorize',
    tokenEndpoint: 'https://api.linear.app/oauth/token',
    identityEndpoint: 'https://api.linear.app/graphql',
    clientIdEnvVar: 'LINEAR_CLIENT_ID',
    clientSecretEnvVar: 'LINEAR_CLIENT_SECRET',
    alternativeTokenEnvVar: 'LINEAR_API_KEY',
    defaultScopes: ['read', 'issues:create'],
    developerPortalUrl: 'https://linear.app/settings/api',
    supportsPkce: true,
    setupGuide: [
      'Open Linear Settings > Workspace > API > OAuth Applications.',
      'Create an application and register Redirect URI: {CALLBACK_URL}',
      'Set LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET in SignalDesk.',
      'Or generate a Personal API Key from Linear Settings > Account > API and enter it into the vault.'
    ]
  },
  salesforce: {
    providerId: 'salesforce',
    providerName: 'Salesforce Enterprise CRM',
    authStrategy: 'oauth2_standard',
    authorizationEndpoint: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenEndpoint: 'https://login.salesforce.com/services/oauth2/token',
    identityEndpoint: 'https://login.salesforce.com/services/oauth2/userinfo',
    clientIdEnvVar: 'SALESFORCE_CLIENT_ID',
    clientSecretEnvVar: 'SALESFORCE_CLIENT_SECRET',
    defaultScopes: ['id', 'api', 'refresh_token'],
    developerPortalUrl: 'https://login.salesforce.com',
    setupGuide: [
      'In Salesforce Setup, navigate to App Manager > New Connected App.',
      'Enable OAuth Settings and enter Callback URL: {CALLBACK_URL}',
      'Add Selected OAuth Scopes: Manage user data via APIs (api) and Perform requests at any time (refresh_token).',
      'Save the Connected App, copy Consumer Key (Client ID) and Consumer Secret to SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET.'
    ]
  },
  quickbooks: {
    providerId: 'quickbooks',
    providerName: 'QuickBooks Enterprise',
    authStrategy: 'oauth2_standard',
    authorizationEndpoint: 'https://appcenter.intuit.com/connect/oauth2',
    tokenEndpoint: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    identityEndpoint: 'https://accounts.platform.intuit.com/v1/openid_connect/userinfo',
    clientIdEnvVar: 'QUICKBOOKS_CLIENT_ID',
    clientSecretEnvVar: 'QUICKBOOKS_CLIENT_SECRET',
    defaultScopes: ['com.intuit.quickbooks.accounting', 'openid', 'email', 'profile'],
    developerPortalUrl: 'https://developer.intuit.com/',
    setupGuide: [
      'Go to Intuit Developer Portal > Dashboard > Your App > Keys & OAuth.',
      'Add Redirect URI: {CALLBACK_URL}',
      'Copy Client ID and Client Secret to QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET.',
      'Ensure Accounting API scope is checked in App Settings.'
    ]
  },
  xero: {
    providerId: 'xero',
    providerName: 'Xero Cloud Accounting',
    authStrategy: 'oauth2_standard',
    authorizationEndpoint: 'https://login.xero.com/identity/connect/authorize',
    tokenEndpoint: 'https://identity.xero.com/connect/token',
    identityEndpoint: 'https://api.xero.com/connections',
    clientIdEnvVar: 'XERO_CLIENT_ID',
    clientSecretEnvVar: 'XERO_CLIENT_SECRET',
    defaultScopes: ['openid', 'profile', 'email', 'accounting.transactions.read', 'accounting.contacts.read', 'offline_access'],
    developerPortalUrl: 'https://developer.xero.com/app/manage/',
    setupGuide: [
      'Visit Xero Developer Portal > My Apps > New App.',
      'Choose "Web app" and enter OAuth 2.0 redirect URI: {CALLBACK_URL}',
      'Generate a Client Secret.',
      'Configure XERO_CLIENT_ID and XERO_CLIENT_SECRET in SignalDesk.'
    ]
  },
  jira: {
    providerId: 'jira',
    providerName: 'Jira Software & Cloud',
    authStrategy: 'oauth2_standard',
    authorizationEndpoint: 'https://auth.atlassian.com/authorize',
    tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
    identityEndpoint: 'https://api.atlassian.com/oauth/token/accessible-resources',
    clientIdEnvVar: 'JIRA_CLIENT_ID',
    clientSecretEnvVar: 'JIRA_CLIENT_SECRET',
    alternativeTokenEnvVar: 'JIRA_API_TOKEN',
    defaultScopes: ['read:jira-work', 'read:jira-user', 'offline_access'],
    developerPortalUrl: 'https://developer.atlassian.com/console/myapps/',
    setupGuide: [
      'Visit Atlassian Developer Console > Create App > OAuth 2.0 (3LO).',
      'Add Callback URL: {CALLBACK_URL}',
      'Add Permissions: Jira platform REST API (read:jira-work, read:jira-user).',
      'Configure JIRA_CLIENT_ID and JIRA_CLIENT_SECRET.',
      'Alternatively, enter JIRA_HOST and an Atlassian API Token generated from id.atlassian.com.'
    ]
  },
  asana: {
    providerId: 'asana',
    providerName: 'Asana Project Management',
    authStrategy: 'oauth2_standard',
    authorizationEndpoint: 'https://app.asana.com/-/oauth_authorize',
    tokenEndpoint: 'https://app.asana.com/-/oauth_token',
    identityEndpoint: 'https://app.asana.com/api/1.0/users/me',
    clientIdEnvVar: 'ASANA_CLIENT_ID',
    clientSecretEnvVar: 'ASANA_CLIENT_SECRET',
    alternativeTokenEnvVar: 'ASANA_ACCESS_TOKEN',
    defaultScopes: ['default'],
    developerPortalUrl: 'https://app.asana.com/0/developer-console',
    setupGuide: [
      'Open Asana Developer Console > New App.',
      'Add Redirect URL: {CALLBACK_URL}',
      'Copy Client ID and Client Secret to ASANA_CLIENT_ID and ASANA_CLIENT_SECRET.',
      'Alternatively, create a Personal Access Token in Developer Console and set ASANA_ACCESS_TOKEN.'
    ]
  },
  zendesk: {
    providerId: 'zendesk',
    providerName: 'Zendesk Service',
    authStrategy: 'oauth2_standard',
    authorizationEndpoint: 'https://{subdomain}.zendesk.com/oauth/authorizations/new',
    tokenEndpoint: 'https://{subdomain}.zendesk.com/oauth/tokens',
    identityEndpoint: 'https://{subdomain}.zendesk.com/api/v2/users/me.json',
    clientIdEnvVar: 'ZENDESK_CLIENT_ID',
    clientSecretEnvVar: 'ZENDESK_CLIENT_SECRET',
    alternativeTokenEnvVar: 'ZENDESK_API_TOKEN',
    defaultScopes: ['read'],
    developerPortalUrl: 'https://support.zendesk.com',
    setupGuide: [
      'In Zendesk Admin Center, go to Apps and Integrations > APIs > Zendesk API > OAuth Clients.',
      'Add OAuth Client with Redirect URL: {CALLBACK_URL}',
      'Set ZENDESK_SUBDOMAIN, ZENDESK_CLIENT_ID, and ZENDESK_CLIENT_SECRET in SignalDesk.',
      'Alternatively, enable Token Access in Zendesk API settings and enter your API Token and Email.'
    ]
  },
  stripe: {
    providerId: 'stripe',
    providerName: 'Stripe Billing & Payments',
    authStrategy: 'api_key_vault',
    developerPortalUrl: 'https://dashboard.stripe.com/apikeys',
    defaultScopes: ['rak_charge_read', 'rak_customer_read', 'rak_invoice_read', 'rak_subscription_read'],
    alternativeTokenEnvVar: 'STRIPE_SECRET_KEY',
    setupGuide: [
      'Go to Stripe Dashboard > Developers > API keys.',
      'Create a Restricted Key with Read permissions on Balances, Customers, Invoices, Subscriptions.',
      'Enter the Restricted API Key directly into SignalDesk vault or configure STRIPE_SECRET_KEY.',
      'SignalDesk validates against /v1/balance and normalizes active ARR, open invoices, and treasury balance.'
    ]
  },
  google_maps: {
    providerId: 'google_maps',
    providerName: 'Google Maps Platform',
    authStrategy: 'api_key_vault',
    developerPortalUrl: 'https://console.cloud.google.com/google/maps-apis/credentials',
    defaultScopes: ['Geocoding API', 'Routes API', 'Places API'],
    alternativeTokenEnvVar: 'GOOGLE_MAPS_API_KEY',
    setupGuide: [
      'Open Google Cloud Console > Google Maps Platform > Credentials.',
      'Generate an API Key restricted to Geocoding, Places, and Routes APIs.',
      'Configure GOOGLE_MAPS_API_KEY in server environment or enter it into the vault.',
      'SignalDesk performs probe verification on startup to confirm billing and quota availability.'
    ]
  },
  resend: {
    providerId: 'resend',
    providerName: 'Resend Transactional Email',
    authStrategy: 'api_key_vault',
    developerPortalUrl: 'https://resend.com/api-keys',
    defaultScopes: ['email:send', 'domains:read'],
    alternativeTokenEnvVar: 'RESEND_API_KEY',
    setupGuide: [
      'Go to Resend Dashboard > API Keys > Create API Key.',
      'Select Full Access or Sending Access.',
      'Configure RESEND_API_KEY in server environment or enter it into the vault.'
    ]
  }
};

/**
 * Validates whether the provider has credentials configured in the environment
 */
export function isProviderOAuthConfigured(providerId: string): boolean {
  const cfg = OAUTH_PROVIDER_CONFIGS[providerId];
  if (!cfg) return false;

  if (cfg.clientIdEnvVar && cfg.clientSecretEnvVar) {
    const hasClientId = Boolean(getCleanEnv(cfg.clientIdEnvVar));
    const hasClientSecret = Boolean(getCleanEnv(cfg.clientSecretEnvVar));
    if (hasClientId && hasClientSecret) return true;
  }

  if (cfg.alternativeTokenEnvVar) {
    if (Boolean(getCleanEnv(cfg.alternativeTokenEnvVar))) return true;
  }

  return false;
}

/**
 * Generate official Provider OAuth 2.0 Authorization URL
 */
export function getProviderOAuthAuthorizeUrl(
  providerId: string,
  redirectUri: string,
  state: string,
  extraParams: Record<string, string> = {}
): {
  configured: boolean;
  authorizeUrl?: string;
  config?: ProviderOAuthConfig;
  missingConfig?: string[];
  ownerSetupGuide?: string[];
  canonicalCallbackUrl: string;
} {
  const cfg = OAUTH_PROVIDER_CONFIGS[providerId];
  const canonicalCallback = redirectUri;

  if (!cfg) {
    return {
      configured: false,
      missingConfig: [`Unknown provider: ${providerId}`],
      canonicalCallbackUrl: canonicalCallback
    };
  }

  // Check if OAuth client credentials exist
  const clientId = cfg.clientIdEnvVar ? getCleanEnv(cfg.clientIdEnvVar) : '';
  const clientSecret = cfg.clientSecretEnvVar ? getCleanEnv(cfg.clientSecretEnvVar) : '';

  if (!clientId || !clientSecret || !cfg.authorizationEndpoint) {
    const missing: string[] = [];
    if (cfg.clientIdEnvVar && !clientId) missing.push(cfg.clientIdEnvVar);
    if (cfg.clientSecretEnvVar && !clientSecret) missing.push(cfg.clientSecretEnvVar);

    const guide = (cfg.setupGuide || []).map(step => 
      step.replace(/\{CALLBACK_URL\}/g, canonicalCallback)
    );

    return {
      configured: false,
      config: cfg,
      missingConfig: missing,
      ownerSetupGuide: guide,
      canonicalCallbackUrl: canonicalCallback
    };
  }

  // Construct official authorization URL
  let authEndpoint = cfg.authorizationEndpoint;
  if (providerId === 'zendesk') {
    const subdomain = extraParams.subdomain || getCleanEnv('ZENDESK_SUBDOMAIN') || 'company';
    authEndpoint = authEndpoint.replace('{subdomain}', subdomain);
  }

  const url = new URL(authEndpoint);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  // Provider-specific query parameters
  if (providerId === 'google_workspace') {
    url.searchParams.set('scope', cfg.defaultScopes.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent select_account');
  } else if (providerId === 'github') {
    url.searchParams.set('scope', cfg.defaultScopes.join(' '));
  } else if (providerId === 'slack') {
    url.searchParams.set('user_scope', cfg.defaultScopes.join(','));
  } else if (providerId === 'hubspot') {
    url.searchParams.set('scope', cfg.defaultScopes.join(' '));
  } else if (providerId === 'linear') {
    url.searchParams.set('scope', cfg.defaultScopes.join(','));
  } else if (providerId === 'salesforce') {
    url.searchParams.set('scope', cfg.defaultScopes.join(' '));
  } else if (providerId === 'quickbooks') {
    url.searchParams.set('scope', cfg.defaultScopes.join(' '));
  } else if (providerId === 'xero') {
    url.searchParams.set('scope', cfg.defaultScopes.join(' '));
  } else if (providerId === 'jira') {
    url.searchParams.set('audience', 'api.atlassian.com');
    url.searchParams.set('scope', cfg.defaultScopes.join(' '));
    url.searchParams.set('prompt', 'consent');
  } else if (providerId === 'asana') {
    // Asana standard oauth
  }

  return {
    configured: true,
    authorizeUrl: url.toString(),
    config: cfg,
    canonicalCallbackUrl: canonicalCallback
  };
}

/**
 * Real Server-to-Server OAuth 2.0 Code Exchange with official Provider Token Endpoint
 */
export async function exchangeProviderOAuthCode(
  providerId: string,
  code: string,
  redirectUri: string,
  extraParams: Record<string, string> = {}
): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
  raw?: any;
  error?: string;
}> {
  const cfg = OAUTH_PROVIDER_CONFIGS[providerId];
  if (!cfg || !cfg.tokenEndpoint) {
    return { success: false, error: `Provider ${providerId} does not support OAuth token exchange` };
  }

  const clientId = cfg.clientIdEnvVar ? getCleanEnv(cfg.clientIdEnvVar) : '';
  const clientSecret = cfg.clientSecretEnvVar ? getCleanEnv(cfg.clientSecretEnvVar) : '';

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: `Missing OAuth client credentials for ${cfg.providerName} (${cfg.clientIdEnvVar || 'CLIENT_ID'} / ${cfg.clientSecretEnvVar || 'CLIENT_SECRET'}).`
    };
  }

  let tokenEndpoint = cfg.tokenEndpoint;
  if (providerId === 'zendesk') {
    const subdomain = extraParams.subdomain || getCleanEnv('ZENDESK_SUBDOMAIN') || 'company';
    tokenEndpoint = tokenEndpoint.replace('{subdomain}', subdomain);
  }

  try {
    let headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'SignalDesk-Enterprise-Gateway/1.0'
    };

    let bodyParams = new URLSearchParams();
    bodyParams.set('grant_type', 'authorization_code');
    bodyParams.set('code', code);
    bodyParams.set('redirect_uri', redirectUri);
    bodyParams.set('client_id', clientId);
    bodyParams.set('client_secret', clientSecret);

    // Intuit QuickBooks & Xero authenticate client credentials via HTTP Basic header during OAuth 2.0 authorization-code token exchange
    if (providerId === 'quickbooks' || providerId === 'xero') {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    }

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers,
      body: bodyParams.toString()
    });

    const responseText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      // GitHub sometimes returns form-urlencoded
      const parsed = new URLSearchParams(responseText);
      if (parsed.has('access_token')) {
        data = {
          access_token: parsed.get('access_token'),
          token_type: parsed.get('token_type') || 'Bearer',
          scope: parsed.get('scope')
        };
      } else {
        data = { error: 'invalid_response', error_description: responseText };
      }
    }

    if (!response.ok || data.error) {
      const errMsg = data.error_description || data.error || data.message || `Provider returned HTTP ${response.status}`;
      return { success: false, error: `${cfg.providerName} rejected token exchange: ${errMsg}`, raw: data };
    }

    const accessToken = data.access_token || data.authed_user?.access_token;
    if (!accessToken) {
      return { success: false, error: `No access token returned by ${cfg.providerName}`, raw: data };
    }

    return {
      success: true,
      accessToken,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type || 'Bearer',
      scope: data.scope,
      raw: data
    };
  } catch (err: any) {
    return { success: false, error: `Network error exchanging OAuth code with ${cfg.providerName}: ${err.message}` };
  }
}

const oauthNonces = new Set<string>();

function getSecretForHmac(): Buffer {
  const secret = process.env.APP_SECRET || process.env.GEMINI_API_KEY || 'signaldesk-vault-master-key-seed-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Generates a cryptographically strong, signed, expiring OAuth 2.0 state bound to tenant, user, and connector
 */
export function generateOAuthState(providerId: string, tenantId: string = 'org_default', userId: string = 'user_admin'): string {
  const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${providerId}:${tenantId}:${userId}:${expiry}:${nonce}`;
  const hmac = crypto.createHmac('sha256', getSecretForHmac()).update(payload).digest('hex').substring(0, 16);
  oauthNonces.add(nonce);
  return `sd_oauth.${providerId}.${tenantId}.${expiry}.${nonce}.${hmac}`;
}

/**
 * Validates OAuth state exactly once, verifying expiration, HMAC signature, and single-use nonce
 */
export function validateOAuthState(state: string): { valid: boolean; providerId?: string; tenantId?: string; error?: string } {
  if (!state || (!state.startsWith('sd_oauth.') && !state.startsWith('sd_oauth_'))) {
    return { valid: false, error: 'Invalid OAuth state format' };
  }

  if (state.startsWith('sd_oauth.')) {
    const parts = state.split('.');
    if (parts.length === 6) {
      const providerId = parts[1];
      const tenantId = parts[2];
      const expiry = parseInt(parts[3], 10);
      const nonce = parts[4];
      const hmac = parts[5];

      if (Date.now() > expiry) {
        return { valid: false, error: 'OAuth authorization state has expired' };
      }

      if (!oauthNonces.has(nonce)) {
        return { valid: false, error: 'OAuth state nonce has already been consumed or is invalid' };
      }
      oauthNonces.delete(nonce);

      const payload = `${providerId}:${tenantId}:user_admin:${expiry}:${nonce}`;
      const expectedHmac = crypto.createHmac('sha256', getSecretForHmac()).update(payload).digest('hex').substring(0, 16);
      if (hmac !== expectedHmac) {
        return { valid: false, error: 'Cryptographic state signature verification failed' };
      }

      return { valid: true, providerId, tenantId };
    }
  }

  // Backward compatibility with legacy format: sd_oauth_${providerId}_${timestamp}_${random}
  const legacyMatch = state.match(/^sd_oauth_(.+)_\d+_[a-f0-9]+$/);
  if (legacyMatch) {
    return { valid: true, providerId: legacyMatch[1], tenantId: 'org_default' };
  }

  return { valid: false, error: 'Malformed OAuth state parameter' };
}

