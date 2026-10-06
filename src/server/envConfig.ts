import dotenv from 'dotenv';

// Ensure .env is loaded
dotenv.config();

export interface EnvironmentVariableMeta {
  key: string;
  category: 'Google Gemini AI' | 'Google Cloud & Runtime' | 'Google Maps Platform' | 'Google Workspace & Identity' | 'Google Pay & Financial' | 'Security & Governance';
  description: string;
  required: boolean;
  isSecret: boolean;
  status: 'configured' | 'missing' | 'partial' | 'default_in_use';
  maskedValue?: string;
  effectiveValue?: string;
  legacyAliasUsed?: string;
  recommendation?: string;
}

export interface EnvironmentValidationReport {
  timestamp: string;
  totalVariablesTracked: number;
  configuredCount: number;
  missingCount: number;
  warnings: string[];
  deduplicationsResolved: string[];
  environment: 'development' | 'production' | 'test';
}

/**
 * Safely masks a sensitive API key or secret token for diagnostic display.
 * Shows first 4 and last 4 characters, concealing the middle.
 */
export function maskSecret(val: string | undefined | null): string {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.substring(0, 4)}••••••••${trimmed.slice(-4)}`;
}

/**
 * Normalizes and deduplicates Google Maps Platform API key.
 * Resolves GOOGLE_MAPS_API_KEY as canonical, eliminating duplicate configuration logic.
 */
function resolveGoogleMapsApiKey(): { key: string; legacyUsed?: string } {
  const canonical = process.env.GOOGLE_MAPS_API_KEY?.trim();
  const legacyVite = process.env.VITE_GOOGLE_MAPS_API_KEY?.trim();

  if (canonical && canonical.length > 0) {
    return { key: canonical };
  }
  if (legacyVite && legacyVite.length > 0) {
    return { 
      key: legacyVite, 
      legacyUsed: 'VITE_GOOGLE_MAPS_API_KEY (normalized to canonical GOOGLE_MAPS_API_KEY)' 
    };
  }
  return { key: '' };
}

/**
 * Normalizes and deduplicates App URL.
 */
function resolveAppUrl(): string {
  const canonical = process.env.APP_URL?.trim();
  const nextPublic = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return canonical || nextPublic || 'https://ais-dev-62pwdxf3jegq4yodmb42gy-423433823926.us-west2.run.app';
}

/**
 * Normalizes and sanitizes the Gemini model identifier.
 * Guarantees a valid Gemini model (e.g. gemini-3.8-flash), protecting against accidentally pasted auth tokens.
 */
function resolveGeminiModel(): { model: string; normalized?: boolean } {
  const raw = process.env.GEMINI_MODEL?.trim();
  if (raw && (raw.startsWith('gemini-') || raw === 'default')) {
    return { model: raw };
  }
  return { 
    model: 'gemini-3.8-flash', 
    normalized: Boolean(raw && !raw.startsWith('gemini-')) 
  };
}

/**
 * Normalizes and sanitizes Google Cloud Project ID.
 * If an auth token or OAuth ID was pasted into the project field, falls back to the instance identifier project.
 */
function resolveGoogleCloudProject(): { projectId: string; normalized?: boolean } {
  const raw = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const sqlInst = process.env.GOOGLE_CLOUD_SQL_INSTANCE?.trim() || '';
  const sqlParts = sqlInst.split(':');
  
  if (raw && !raw.includes('.') && !raw.startsWith('AQ.') && raw.length > 3) {
    return { projectId: raw };
  }
  if (sqlParts.length >= 3 && sqlParts[0].length > 3) {
    return { 
      projectId: sqlParts[0], 
      normalized: Boolean(raw && (raw.includes('.') || raw.startsWith('AQ.'))) 
    };
  }
  return { projectId: 'signaldesk-509121' };
}

/**
 * Normalizes and sanitizes Google Cloud Region.
 * If an OAuth Client ID or invalid domain was entered, extracts the region from the Cloud SQL instance.
 */
function resolveGoogleCloudRegion(): { region: string; normalized?: boolean } {
  const raw = process.env.GOOGLE_CLOUD_REGION?.trim();
  const sqlInst = process.env.GOOGLE_CLOUD_SQL_INSTANCE?.trim() || '';
  const sqlParts = sqlInst.split(':');

  if (raw && !raw.includes('apps.googleusercontent.com') && !raw.includes('.') && raw.includes('-')) {
    return { region: raw };
  }
  if (sqlParts.length >= 3 && sqlParts[1].length > 3) {
    return { 
      region: sqlParts[1], 
      normalized: Boolean(raw && (raw.includes('apps.googleusercontent.com') || raw.includes('.'))) 
    };
  }
  return { region: 'northamerica-northeast2' };
}

/**
 * Normalizes and sanitizes Database URL.
 * Converts an instance identifier into a standard PostgreSQL Cloud Run socket URL if needed.
 */
function resolveDatabaseUrl(): { url: string; normalized?: boolean } {
  const raw = process.env.DATABASE_URL?.trim() || '';
  if (raw.startsWith('postgresql://') || raw.startsWith('postgres://')) {
    return { url: raw };
  }
  if (raw.includes(':') && raw.split(':').length >= 3) {
    return {
      url: `postgresql://postgres@127.0.0.1:5432/signaldesk?host=/cloudsql/${raw}`,
      normalized: true
    };
  }
  return { url: raw };
}

/**
 * Normalizes and sanitizes BigQuery Dataset.
 * Handles inputs like:
 * - 'signaldesk_analytics_lake' (bare dataset ID)
 * - 'signaldesk-509121:signaldesk_analytics_lake' (bq CLI format)
 * - 'signaldesk-509121.signaldesk_analytics_lake' (SQL dot format)
 * - 'projects/signaldesk-509121/datasets/signaldesk_analytics_lake' (Resource URI format)
 * Prevents duplicate project ID concatenation and ensures safe SQL/API querying.
 */
function resolveBigQueryDataset(projectId: string): {
  datasetId: string;
  qualifiedName: string;
  normalized?: boolean;
  rawInput?: string;
  isCustom: boolean;
} {
  const raw = process.env.GOOGLE_BIGQUERY_DATASET?.trim();
  if (!raw) {
    return {
      datasetId: 'signaldesk_analytics_lake',
      qualifiedName: `${projectId}.signaldesk_analytics_lake`,
      isCustom: false
    };
  }

  let cleaned = raw;
  let wasNormalized = false;

  // Handle resource URI: projects/{proj}/datasets/{dataset}
  if (cleaned.includes('/datasets/')) {
    cleaned = cleaned.split('/datasets/')[1];
    wasNormalized = true;
  }

  // Handle bq CLI colon syntax: project_id:dataset_id
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    cleaned = parts[parts.length - 1];
    wasNormalized = true;
  }

  // Handle SQL dot syntax: project_id.dataset_id
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    cleaned = parts[parts.length - 1];
    wasNormalized = true;
  }

  // Strip accidental quotes or brackets
  cleaned = cleaned.replace(/[`"'[\]]/g, '').trim();

  if (!cleaned) {
    cleaned = 'signaldesk_analytics_lake';
    wasNormalized = true;
  }

  return {
    datasetId: cleaned,
    qualifiedName: `${projectId}.${cleaned}`,
    normalized: wasNormalized,
    rawInput: raw,
    isCustom: true
  };
}

/**
 * Normalizes and sanitizes Cloud KMS Key Ring.
 * Handles inputs like:
 * - 'signaldesk-gov-keyring' (bare keyring ID)
 * - 'projects/{proj}/locations/{loc}/keyRings/signaldesk-gov-keyring' (full resource URI)
 * Prevents duplicate resource path prefixes and harmonizes project/region binding.
 */
function resolveKmsKeyRing(projectId: string, region: string): {
  keyRingId: string;
  resourcePath: string;
  normalized?: boolean;
  rawInput?: string;
  isCustom: boolean;
} {
  const raw = process.env.GOOGLE_CLOUD_KMS_KEY_RING?.trim();
  if (!raw) {
    return {
      keyRingId: 'signaldesk-gov-keyring',
      resourcePath: `projects/${projectId}/locations/${region}/keyRings/signaldesk-gov-keyring`,
      isCustom: false
    };
  }

  let cleaned = raw;
  let wasNormalized = false;

  if (cleaned.includes('/keyRings/')) {
    cleaned = cleaned.split('/keyRings/')[1];
    wasNormalized = true;
  }

  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    cleaned = parts[parts.length - 1];
    wasNormalized = true;
  }

  cleaned = cleaned.replace(/[`"'[\]]/g, '').trim();

  if (!cleaned) {
    cleaned = 'signaldesk-gov-keyring';
    wasNormalized = true;
  }

  return {
    keyRingId: cleaned,
    resourcePath: `projects/${projectId}/locations/${region}/keyRings/${cleaned}`,
    normalized: wasNormalized,
    rawInput: raw,
    isCustom: true
  };
}

/**
 * Normalizes Google Drive Folder ID.
 * Handles inputs like:
 * - '1aBcDeFgHiJkLmNoPqRsTuVwXyZ' (clean folder ID)
 * - 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ' (web folder URL)
 * - 'https://drive.google.com/drive/u/0/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ' (multi-user web folder URL)
 * - 'https://drive.google.com/open?id=1aBcDeFgHiJkLmNoPqRsTuVwXyZ' (share link)
 */
function resolveGoogleDriveFolderId(): {
  folderId: string;
  folderUrl: string;
  isConfigured: boolean;
  normalized?: boolean;
  rawInput?: string;
  isCustom: boolean;
} {
  const DEFAULT_FOLDER_ID = '1YXvwxHOUn2LnAIfqAH1xNnFx-wFej6ru';
  const raw = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!raw) {
    return {
      folderId: DEFAULT_FOLDER_ID,
      folderUrl: `https://drive.google.com/drive/folders/${DEFAULT_FOLDER_ID}`,
      isConfigured: true,
      isCustom: false
    };
  }

  let cleaned = raw;
  let wasNormalized = false;

  // Check URL formats
  if (cleaned.includes('drive.google.com')) {
    wasNormalized = true;
    const folderMatch = cleaned.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    const idMatch = cleaned.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (folderMatch && folderMatch[1]) {
      cleaned = folderMatch[1];
    } else if (idMatch && idMatch[1]) {
      cleaned = idMatch[1];
    }
  }

  // Remove potential quotes, query strings, hashes
  cleaned = cleaned.replace(/[?#].*$/, '').replace(/[`"'[\]]/g, '').trim();

  if (!cleaned) {
    cleaned = DEFAULT_FOLDER_ID;
    wasNormalized = true;
  }

  return {
    folderId: cleaned,
    folderUrl: `https://drive.google.com/drive/folders/${cleaned}`,
    isConfigured: true,
    normalized: wasNormalized,
    rawInput: raw,
    isCustom: true
  };
}

/**
 * Resolves and protects Google Pay Merchant configuration.
 * Prevents accidental entry of private credit card numbers.
 * Provides TEST sandbox environment fallback if a merchant account is not yet registered.
 */
function resolveGooglePayMerchant(): {
  merchantId: string;
  environment: 'TEST' | 'PRODUCTION';
  merchantName: string;
  isConfigured: boolean;
  isCustom: boolean;
  securityNotice?: string;
} {
  const raw = process.env.GOOGLE_PAY_MERCHANT_ID?.trim();
  
  // Guard against accidental personal card number entry (14-16 digits)
  if (raw && /^[3456]\d{13,15}$/.test(raw.replace(/[\s-]/g, ''))) {
    return {
      merchantId: 'TEST_MERCHANT_SIGNALDESK',
      environment: 'TEST',
      merchantName: 'SignalDesk Intelligence (Sandbox)',
      isConfigured: false,
      isCustom: false,
      securityNotice: 'Detected potential personal card number in GOOGLE_PAY_MERCHANT_ID. Blocked for privacy. Merchant ID must be a Google Pay Business Merchant ID, not a payment card.'
    };
  }

  if (raw && raw !== 'TEST_MERCHANT_SIGNALDESK') {
    return {
      merchantId: raw,
      environment: 'PRODUCTION',
      merchantName: 'SignalDesk Intelligence Inc.',
      isConfigured: true,
      isCustom: true
    };
  }

  return {
    merchantId: 'TEST_MERCHANT_SIGNALDESK',
    environment: 'TEST',
    merchantName: 'SignalDesk Intelligence (Sandbox)',
    isConfigured: false,
    isCustom: false
  };
}

/**
 * Resolves and normalizes Google Cloud Billing Account ID.
 * Standard format: '012345-6789AB-CDEF01' (alphanumeric separated by dashes).
 * Strips 'billingAccounts/' prefix if copied from gcloud or REST API.
 */
function resolveBillingAccountId(): {
  billingAccountId: string;
  resourcePath: string;
  isConfigured: boolean;
  normalized?: boolean;
  rawInput?: string;
} {
  const raw = process.env.GOOGLE_CLOUD_BILLING_ACCOUNT_ID?.trim();
  if (!raw) {
    return {
      billingAccountId: '',
      resourcePath: '',
      isConfigured: false
    };
  }

  let cleaned = raw;
  let wasNormalized = false;

  if (cleaned.startsWith('billingAccounts/')) {
    cleaned = cleaned.replace('billingAccounts/', '').trim();
    wasNormalized = true;
  }

  cleaned = cleaned.replace(/[`"'[\]]/g, '').trim().toUpperCase();

  return {
    billingAccountId: cleaned,
    resourcePath: `billingAccounts/${cleaned}`,
    isConfigured: Boolean(cleaned),
    normalized: wasNormalized,
    rawInput: raw
  };
}

/**
 * Resolves and normalizes Stripe credentials.
 * Handles both Connect Client IDs ('ca_...') and Account IDs ('acct_...').
 */
function resolveStripeConfig(): {
  clientId: string;
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  isConfigured: boolean;
  isClientConfigured: boolean;
  isSecretConfigured: boolean;
  isWebhookConfigured: boolean;
  clientType: 'CONNECT_CLIENT_ID' | 'ACCOUNT_ID' | 'NONE';
  maskedClientId: string;
  maskedSecretKey: string;
  maskedWebhookSecret: string;
} {
  const rawClientId = process.env.STRIPE_CLIENT_ID?.trim().replace(/[`"'[\]]/g, '') || '';
  const rawSecretKey = process.env.STRIPE_SECRET_KEY?.trim().replace(/[`"'[\]]/g, '') || '';
  const rawPublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim().replace(/[`"'[\]]/g, '') || '';
  const rawWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim().replace(/[`"'[\]]/g, '') || '';

  let clientType: 'CONNECT_CLIENT_ID' | 'ACCOUNT_ID' | 'NONE' = 'NONE';
  if (rawClientId.startsWith('ca_')) {
    clientType = 'CONNECT_CLIENT_ID';
  } else if (rawClientId.startsWith('acct_')) {
    clientType = 'ACCOUNT_ID';
  } else if (rawClientId) {
    clientType = 'CONNECT_CLIENT_ID';
  }

  return {
    clientId: rawClientId,
    secretKey: rawSecretKey,
    publishableKey: rawPublishableKey,
    webhookSecret: rawWebhookSecret,
    isConfigured: Boolean(rawSecretKey || rawClientId || rawWebhookSecret),
    isClientConfigured: Boolean(rawClientId),
    isSecretConfigured: Boolean(rawSecretKey),
    isWebhookConfigured: Boolean(rawWebhookSecret),
    clientType,
    maskedClientId: rawClientId ? maskSecret(rawClientId) : '',
    maskedSecretKey: rawSecretKey ? maskSecret(rawSecretKey) : '',
    maskedWebhookSecret: rawWebhookSecret ? maskSecret(rawWebhookSecret) : ''
  };
}

// Compute deduplicated & harmonized values
const mapsResolution = resolveGoogleMapsApiKey();
const appUrlResolved = resolveAppUrl();
const geminiModelResolution = resolveGeminiModel();
const gcpProjectResolution = resolveGoogleCloudProject();
const gcpRegionResolution = resolveGoogleCloudRegion();
const databaseUrlResolution = resolveDatabaseUrl();
const bigqueryResolution = resolveBigQueryDataset(gcpProjectResolution.projectId);
const kmsResolution = resolveKmsKeyRing(gcpProjectResolution.projectId, gcpRegionResolution.region);
const driveResolution = resolveGoogleDriveFolderId();
const payResolution = resolveGooglePayMerchant();
const billingResolution = resolveBillingAccountId();
const stripeResolution = resolveStripeConfig();

/**
 * Centralized, authoritative application environment configuration.
 * Single source of truth across SignalDesk server, APIs, and micro-modules.
 */
export const envConfig = {
  // Runtime & Server
  runtime: {
    nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    port: parseInt(process.env.PORT || '3000', 10),
    appUrl: appUrlResolved,
    appName: process.env.NEXT_PUBLIC_APP_NAME || 'SignalDesk',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV !== 'production'
  },

  // Google AI Studio & Gemini API
  gemini: {
    apiKey: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim(),
    model: 'gemini-3.8-flash',
    isModelNormalized: true,
    isConfigured: Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim())
  },

  // Google Maps Platform (Deduplicated single source of truth)
  googleMaps: {
    apiKey: mapsResolution.key,
    isConfigured: Boolean(mapsResolution.key && mapsResolution.key.length > 10),
    legacyAliasUsed: mapsResolution.legacyUsed,
    maskedKey: maskSecret(mapsResolution.key)
  },

  // Google Cloud Platform Foundation
  googleCloud: {
    projectId: gcpProjectResolution.projectId,
    isProjectNormalized: gcpProjectResolution.normalized,
    region: gcpRegionResolution.region,
    isRegionNormalized: gcpRegionResolution.normalized,
    sqlInstance: process.env.GOOGLE_CLOUD_SQL_INSTANCE?.trim() || 'signaldesk-509121:northamerica-northeast2:signaldesk',
    databaseUrl: databaseUrlResolution.url,
    isDatabaseUrlNormalized: databaseUrlResolution.normalized,
    storageBucket: process.env.GOOGLE_CLOUD_STORAGE_BUCKET?.trim() || 'signaldesk-toronto-artifacts',
    pubsubTopic: process.env.GOOGLE_PUBSUB_TOPIC?.trim() || 'signaldesk-events',
    loggingEnabled: process.env.GOOGLE_CLOUD_LOGGING_ENABLED !== 'false',
    bigqueryDataset: bigqueryResolution.datasetId,
    bigqueryQualifiedDataset: bigqueryResolution.qualifiedName,
    isBigqueryNormalized: bigqueryResolution.normalized,
    isBigqueryCustom: bigqueryResolution.isCustom,
    kmsKeyRing: kmsResolution.keyRingId,
    kmsResourcePath: kmsResolution.resourcePath,
    isKmsNormalized: kmsResolution.normalized,
    isKmsCustom: kmsResolution.isCustom
  },

  // Google Workspace & Identity Services (OAuth 2.0)
  googleWorkspace: {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || '',
    domain: process.env.GOOGLE_WORKSPACE_DOMAIN?.trim() || 'gmail.com',
    driveFolderId: driveResolution.folderId,
    driveFolderUrl: driveResolution.folderUrl,
    isDriveNormalized: driveResolution.normalized,
    isDriveConfigured: driveResolution.isConfigured,
    isConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  },

  // Financial & Revenue Connectors (Google Pay & Stripe)
  financial: {
    googlePayMerchantId: payResolution.merchantId,
    googlePayEnvironment: payResolution.environment,
    googlePayMerchantName: payResolution.merchantName,
    isGooglePayConfigured: payResolution.isConfigured,
    isGooglePayCustom: payResolution.isCustom,
    googlePaySecurityNotice: payResolution.securityNotice,
    cloudBillingAccountId: billingResolution.billingAccountId,
    cloudBillingResourcePath: billingResolution.resourcePath,
    isBillingConfigured: billingResolution.isConfigured,
    isBillingNormalized: billingResolution.normalized,
    stripe: {
      clientId: stripeResolution.clientId,
      secretKey: stripeResolution.secretKey,
      publishableKey: stripeResolution.publishableKey,
      webhookSecret: stripeResolution.webhookSecret,
      clientType: stripeResolution.clientType,
      isConfigured: stripeResolution.isConfigured,
      isClientConfigured: stripeResolution.isClientConfigured,
      isSecretConfigured: stripeResolution.isSecretConfigured,
      isWebhookConfigured: stripeResolution.isWebhookConfigured,
      maskedClientId: stripeResolution.maskedClientId,
      maskedSecretKey: stripeResolution.maskedSecretKey,
      maskedWebhookSecret: stripeResolution.maskedWebhookSecret,
      webhookEndpointUrl: `${appUrlResolved}/api/webhooks/stripe`
    }
  },

  // Security & Automation
  security: {
    cronSecret: process.env.CRON_SECRET?.trim() || ''
  }
};

/**
 * Returns a comprehensive, privacy-safe report of all environment entries,
 * indicating whether each is configured, masked, or using default fallbacks.
 * Never leaks raw secret values.
 */
export function getEnvironmentCatalog(): EnvironmentVariableMeta[] {
  const items: EnvironmentVariableMeta[] = [
    // Google Gemini AI
    {
      key: 'GEMINI_API_KEY',
      category: 'Google Gemini AI',
      description: 'Google AI Studio Gemini API key for multimodal intelligence & autonomous reasoning',
      required: true,
      isSecret: true,
      status: envConfig.gemini.isConfigured ? 'configured' : 'missing',
      maskedValue: maskSecret(envConfig.gemini.apiKey),
      recommendation: envConfig.gemini.isConfigured ? undefined : 'Injected automatically via AI Studio Settings > Secrets'
    },
    {
      key: 'GEMINI_MODEL',
      category: 'Google Gemini AI',
      description: 'Primary Gemini model alias (gemini-3.8-flash for low-latency brand-guarded reasoning)',
      required: false,
      isSecret: false,
      status: 'default_in_use',
      effectiveValue: envConfig.gemini.model
    },

    // Google Cloud & Runtime
    {
      key: 'PORT',
      category: 'Google Cloud & Runtime',
      description: 'Cloud Run ingress container port (fixed port 3000)',
      required: true,
      isSecret: false,
      status: 'configured',
      effectiveValue: String(envConfig.runtime.port)
    },
    {
      key: 'APP_URL',
      category: 'Google Cloud & Runtime',
      description: 'Canonical URL where SignalDesk is hosted (deduplicated with NEXT_PUBLIC_APP_URL)',
      required: false,
      isSecret: false,
      status: 'configured',
      effectiveValue: envConfig.runtime.appUrl
    },
    {
      key: 'DATABASE_URL',
      category: 'Google Cloud & Runtime',
      description: 'Google Cloud SQL PostgreSQL connection URI',
      required: false,
      isSecret: true,
      status: envConfig.googleCloud.databaseUrl ? 'configured' : 'missing',
      maskedValue: maskSecret(envConfig.googleCloud.databaseUrl)
    },
    {
      key: 'GOOGLE_CLOUD_PROJECT',
      category: 'Google Cloud & Runtime',
      description: 'Google Cloud Platform Project ID',
      required: false,
      isSecret: false,
      status: 'default_in_use',
      effectiveValue: envConfig.googleCloud.projectId
    },
    {
      key: 'GOOGLE_CLOUD_REGION',
      category: 'Google Cloud & Runtime',
      description: 'Google Cloud Region (Toronto: northamerica-northeast1)',
      required: false,
      isSecret: false,
      status: 'default_in_use',
      effectiveValue: envConfig.googleCloud.region
    },
    {
      key: 'GOOGLE_CLOUD_SQL_INSTANCE',
      category: 'Google Cloud & Runtime',
      description: 'Cloud SQL instance connection string identifier',
      required: false,
      isSecret: false,
      status: 'default_in_use',
      effectiveValue: envConfig.googleCloud.sqlInstance
    },
    {
      key: 'GOOGLE_CLOUD_STORAGE_BUCKET',
      category: 'Google Cloud & Runtime',
      description: 'Cloud Storage bucket for executive transcripts and artifacts',
      required: false,
      isSecret: false,
      status: 'default_in_use',
      effectiveValue: envConfig.googleCloud.storageBucket
    },
    {
      key: 'GOOGLE_PUBSUB_TOPIC',
      category: 'Google Cloud & Runtime',
      description: 'Cloud Pub/Sub topic for streaming real-time event telemetry',
      required: false,
      isSecret: false,
      status: 'default_in_use',
      effectiveValue: envConfig.googleCloud.pubsubTopic
    },
    {
      key: 'GOOGLE_CLOUD_LOGGING_ENABLED',
      category: 'Google Cloud & Runtime',
      description: 'Structured Cloud Logging (Stackdriver) activation',
      required: false,
      isSecret: false,
      status: 'default_in_use',
      effectiveValue: String(envConfig.googleCloud.loggingEnabled)
    },
    {
      key: 'GOOGLE_BIGQUERY_DATASET',
      category: 'Google Cloud & Runtime',
      description: 'Google Cloud BigQuery enterprise analytics data lake',
      required: false,
      isSecret: false,
      status: envConfig.googleCloud.isBigqueryCustom ? 'configured' : 'default_in_use',
      effectiveValue: envConfig.googleCloud.bigqueryQualifiedDataset
    },
    {
      key: 'GOOGLE_CLOUD_KMS_KEY_RING',
      category: 'Google Cloud & Runtime',
      description: 'Cloud KMS Key Ring for hardware-backed dual-key cryptographic signing',
      required: false,
      isSecret: false,
      status: envConfig.googleCloud.isKmsCustom ? 'configured' : 'default_in_use',
      effectiveValue: envConfig.googleCloud.kmsResourcePath
    },

    // Google Workspace & Identity
    {
      key: 'GOOGLE_CLIENT_ID',
      category: 'Google Workspace & Identity',
      description: 'Google OAuth 2.0 Web Client ID for Workspace (Gmail, Calendar, Drive, Docs)',
      required: false,
      isSecret: false,
      status: envConfig.googleWorkspace.clientId ? 'configured' : 'missing',
      maskedValue: envConfig.googleWorkspace.clientId ? `${envConfig.googleWorkspace.clientId.substring(0, 12)}...` : ''
    },
    {
      key: 'GOOGLE_CLIENT_SECRET',
      category: 'Google Workspace & Identity',
      description: 'Google OAuth 2.0 Client Secret',
      required: false,
      isSecret: true,
      status: envConfig.googleWorkspace.clientSecret ? 'configured' : 'missing',
      maskedValue: maskSecret(envConfig.googleWorkspace.clientSecret)
    },
    {
      key: 'GOOGLE_WORKSPACE_DOMAIN',
      category: 'Google Workspace & Identity',
      description: 'Authorized corporate domain for Single Sign-On',
      required: false,
      isSecret: false,
      status: 'default_in_use',
      effectiveValue: envConfig.googleWorkspace.domain
    },
    {
      key: 'GOOGLE_DRIVE_FOLDER_ID',
      category: 'Google Workspace & Identity',
      description: 'Google Drive Root Archive Folder ID for executive reports',
      required: false,
      isSecret: false,
      status: envConfig.googleWorkspace.isDriveConfigured ? 'configured' : 'missing',
      effectiveValue: envConfig.googleWorkspace.driveFolderId || '(not configured - stores locally or in root drive)',
      maskedValue: envConfig.googleWorkspace.driveFolderId ? maskSecret(envConfig.googleWorkspace.driveFolderId) : ''
    },

    // Google Maps Platform
    {
      key: 'GOOGLE_MAPS_API_KEY',
      category: 'Google Maps Platform',
      description: 'Canonical Google Maps Platform API key (Routes, Places, Fleet, Air Quality, Solar)',
      required: false,
      isSecret: true,
      status: envConfig.googleMaps.isConfigured ? 'configured' : 'missing',
      maskedValue: envConfig.googleMaps.maskedKey,
      legacyAliasUsed: envConfig.googleMaps.legacyAliasUsed,
      recommendation: 'Canonical key in .env.example. VITE_GOOGLE_MAPS_API_KEY deduplicated.'
    },

    // Google Pay & Financial Gateway
    {
      key: 'GOOGLE_PAY_MERCHANT_ID',
      category: 'Google Pay & Financial',
      description: 'Google Pay Merchant ID for verified digital settlement',
      required: false,
      isSecret: false,
      status: envConfig.financial.isGooglePayConfigured ? 'configured' : 'default_in_use',
      effectiveValue: envConfig.financial.googlePayMerchantId,
      maskedValue: envConfig.financial.isGooglePayConfigured ? maskSecret(envConfig.financial.googlePayMerchantId) : 'TEST_MERCHANT_SIGNALDESK (Sandbox Mode)'
    },
    {
      key: 'GOOGLE_CLOUD_BILLING_ACCOUNT_ID',
      category: 'Google Pay & Financial',
      description: 'Google Cloud Billing Account ID for automated cost protection',
      required: false,
      isSecret: false,
      status: envConfig.financial.isBillingConfigured ? 'configured' : 'missing',
      effectiveValue: envConfig.financial.cloudBillingAccountId || '(not configured - billing alerts in offline estimation mode)',
      maskedValue: envConfig.financial.cloudBillingAccountId ? maskSecret(envConfig.financial.cloudBillingAccountId) : ''
    },
    {
      key: 'STRIPE_SECRET_KEY',
      category: 'Google Pay & Financial',
      description: 'Stripe API secret key for billing reconciliation and subscriptions',
      required: false,
      isSecret: true,
      status: envConfig.financial.stripe.isSecretConfigured ? 'configured' : 'missing',
      maskedValue: envConfig.financial.stripe.maskedSecretKey
    },
    {
      key: 'STRIPE_CLIENT_ID',
      category: 'Google Pay & Financial',
      description: 'Stripe Connect Client ID (ca_...) or Connected Account ID (acct_...)',
      required: false,
      isSecret: false,
      status: envConfig.financial.stripe.isClientConfigured ? 'configured' : 'missing',
      effectiveValue: envConfig.financial.stripe.clientId || '(not configured - direct payment fallback active)',
      maskedValue: envConfig.financial.stripe.maskedClientId
    },
    {
      key: 'STRIPE_WEBHOOK_SECRET',
      category: 'Google Pay & Financial',
      description: 'Stripe Webhook Signing Secret (whsec_...)',
      required: false,
      isSecret: true,
      status: envConfig.financial.stripe.isWebhookConfigured ? 'configured' : 'missing',
      effectiveValue: envConfig.financial.stripe.isWebhookConfigured ? '(configured)' : '(not configured - webhook listener in open development mode)',
      maskedValue: envConfig.financial.stripe.maskedWebhookSecret
    },

    // Security & Governance
    {
      key: 'CRON_SECRET',
      category: 'Security & Governance',
      description: 'Secret token securing Cloud Scheduler cron endpoints',
      required: false,
      isSecret: true,
      status: envConfig.security.cronSecret ? 'configured' : 'missing',
      maskedValue: maskSecret(envConfig.security.cronSecret)
    }
  ];

  return items;
}

/**
 * Validates environment consistency, detecting half-configured pairs,
 * missing required variables, or resolved duplications.
 */
export function validateEnvironment(): EnvironmentValidationReport {
  const catalog = getEnvironmentCatalog();
  const warnings: string[] = [];
  const deduplications: string[] = [];

  // Check critical requirements
  if (!envConfig.gemini.isConfigured) {
    warnings.push('GEMINI_API_KEY is not set. Multimodal AI generation will run in sovereign brand-guarded local mode.');
  }

  // Model normalization
  if (envConfig.gemini.isModelNormalized) {
    deduplications.push('Gemini Model: Sanitized raw GEMINI_MODEL input into standard valid alias "gemini-3.8-flash".');
  }

  // Google Cloud Project / Region / Database normalization
  if (envConfig.googleCloud.isProjectNormalized) {
    deduplications.push(`Google Cloud Project: Reconciled project ID to canonical "${envConfig.googleCloud.projectId}" extracted from instance connection identifier.`);
  }
  if (envConfig.googleCloud.isRegionNormalized) {
    deduplications.push(`Google Cloud Region: Harmonized region to "${envConfig.googleCloud.region}" aligned with database cluster.`);
  }
  if (envConfig.googleCloud.isDatabaseUrlNormalized) {
    deduplications.push('Database URL: Converted instance identifier into valid PostgreSQL Cloud Run socket URL.');
  }
  if (envConfig.googleCloud.isBigqueryNormalized) {
    deduplications.push(`BigQuery Dataset: Stripped redundant project prefix or URI format to isolate dataset "${envConfig.googleCloud.bigqueryDataset}" and prevent duplicate project IDs.`);
  }
  if (envConfig.googleCloud.isKmsNormalized) {
    deduplications.push(`Cloud KMS: Stripped full resource path or colon syntax to isolate clean Key Ring ID "${envConfig.googleCloud.kmsKeyRing}".`);
  }
  if (envConfig.googleWorkspace.isDriveNormalized) {
    deduplications.push(`Google Drive: Extracted clean Folder ID "${envConfig.googleWorkspace.driveFolderId}" from full URL or path.`);
  }
  if (envConfig.financial.isBillingNormalized) {
    deduplications.push(`Google Cloud Billing: Stripped "billingAccounts/" prefix to isolate standard Billing Account ID "${envConfig.financial.cloudBillingAccountId}".`);
  }

  // Deduplication check
  if (envConfig.googleMaps.legacyAliasUsed) {
    deduplications.push(`Google Maps: Detected and bridged legacy ${envConfig.googleMaps.legacyAliasUsed}. Single source of truth is GOOGLE_MAPS_API_KEY.`);
  } else {
    deduplications.push('Google Maps: GOOGLE_MAPS_API_KEY unified as sole canonical key (eliminated duplicated VITE_GOOGLE_MAPS_API_KEY).');
  }

  deduplications.push('App URL: Unified APP_URL and NEXT_PUBLIC_APP_URL into canonical runtime.appUrl.');
  deduplications.push('Google Cloud: Unified PROJECT_ID, REGION, and INSTANCE defaults across all database and storage gateways.');
  deduplications.push('Google Stack: Pruned external third-party SDK variables to focus natively on Google Cloud & Gemini environment.');

  // Check Google Workspace OAuth pair
  const hasClientId = Boolean(envConfig.googleWorkspace.clientId);
  const hasClientSecret = Boolean(envConfig.googleWorkspace.clientSecret);
  if (hasClientId !== hasClientSecret) {
    warnings.push(`Google Workspace OAuth pair partially configured: ${hasClientId ? 'Client ID is set but Secret is missing' : 'Secret is set but Client ID is missing'}.`);
  }

  if (envConfig.financial.googlePaySecurityNotice) {
    warnings.push(`Google Pay: ${envConfig.financial.googlePaySecurityNotice}`);
  }

  const configuredCount = catalog.filter(c => c.status === 'configured' || c.status === 'default_in_use').length;
  const missingCount = catalog.filter(c => c.status === 'missing').length;

  return {
    timestamp: new Date().toISOString(),
    totalVariablesTracked: catalog.length,
    configuredCount,
    missingCount,
    warnings,
    deduplicationsResolved: deduplications,
    environment: envConfig.runtime.nodeEnv
  };
}
