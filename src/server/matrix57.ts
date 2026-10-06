import { RealityMatrixEntry, OwnerSetupMatrixEntry } from './connectorCertificationMatrix';
import { getCleanEnv } from './cleanEnv';
import { CONNECTOR_CATALOG_57 } from './catalog57';

export const CONNECTOR_REALITY_MATRIX_57: RealityMatrixEntry[] = [
  // 1. CRM & Revenue
  {
    providerId: 'salesforce',
    providerName: 'Salesforce Enterprise CRM',
    category: 'CRM & Revenue',
    catalog: true,
    authStrategy: 'oauth2_standard',
    credentialsConfigured: Boolean(getCleanEnv('SALESFORCE_CLIENT_ID') && getCleanEnv('SALESFORCE_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://login.salesforce.com/services/oauth2/userinfo',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('SALESFORCE_CLIENT_ID') && getCleanEnv('SALESFORCE_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: (getCleanEnv('SALESFORCE_CLIENT_ID') && getCleanEnv('SALESFORCE_CLIENT_SECRET')) ? 'Ready to initiate OAuth flow' : 'Configure SALESFORCE_CLIENT_ID & SALESFORCE_CLIENT_SECRET in Settings > Secrets'
  },
  {
    providerId: 'hubspot',
    providerName: 'HubSpot CRM & Growth',
    category: 'CRM & Revenue',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('HUBSPOT_ACCESS_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.hubapi.com/oauth/v1/access-tokens/{token}',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('HUBSPOT_ACCESS_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: getCleanEnv('HUBSPOT_ACCESS_TOKEN') ? 'Ready to sync live CRM pipeline' : 'Configure HUBSPOT_ACCESS_TOKEN in Settings > Secrets or enter key in modal'
  },
  {
    providerId: 'gong',
    providerName: 'Gong Revenue Intelligence',
    category: 'CRM & Revenue',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('GONG_API_KEY') && getCleanEnv('GONG_API_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.gong.io/v2/users',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('GONG_API_KEY') && getCleanEnv('GONG_API_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure GONG_API_KEY and GONG_API_SECRET in Settings > Secrets'
  },
  {
    providerId: 'outreach',
    providerName: 'Outreach Sales Execution',
    category: 'CRM & Revenue',
    catalog: true,
    authStrategy: 'oauth2_standard',
    credentialsConfigured: Boolean(getCleanEnv('OUTREACH_CLIENT_ID') && getCleanEnv('OUTREACH_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.outreach.io/api/v2/users/me',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('OUTREACH_CLIENT_ID') && getCleanEnv('OUTREACH_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure OUTREACH_CLIENT_ID and OUTREACH_CLIENT_SECRET in Settings > Secrets'
  },
  {
    providerId: 'salesloft',
    providerName: 'Salesloft Revenue Orchestration',
    category: 'CRM & Revenue',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('SALESLOFT_API_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.salesloft.com/v2/me',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('SALESLOFT_API_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure SALESLOFT_API_KEY in Settings > Secrets or in modal'
  },
  {
    providerId: 'apollo',
    providerName: 'Apollo.io B2B Intelligence',
    category: 'CRM & Revenue',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('APOLLO_API_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'POST https://api.apollo.io/v1/auth/health',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('APOLLO_API_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure APOLLO_API_KEY in Settings > Secrets or in modal'
  },
  {
    providerId: 'zoominfo',
    providerName: 'ZoomInfo Enterprise Intelligence',
    category: 'CRM & Revenue',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('ZOOMINFO_USERNAME') && getCleanEnv('ZOOMINFO_CLIENT_ID')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'POST https://api.zoominfo.com/authenticate',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('ZOOMINFO_USERNAME') && getCleanEnv('ZOOMINFO_CLIENT_ID')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure ZOOMINFO_USERNAME & ZOOMINFO_CLIENT_ID in Settings > Secrets'
  },
  {
    providerId: 'pipedrive',
    providerName: 'Pipedrive CRM',
    category: 'CRM & Revenue',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('PIPEDRIVE_API_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.pipedrive.com/v1/users/me',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('PIPEDRIVE_API_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure PIPEDRIVE_API_TOKEN in Settings > Secrets or in modal'
  },

  // 2. Accounting & Finance
  {
    providerId: 'quickbooks',
    providerName: 'QuickBooks Enterprise',
    category: 'Accounting & Finance',
    catalog: true,
    authStrategy: 'oauth2_standard',
    credentialsConfigured: Boolean(getCleanEnv('QUICKBOOKS_CLIENT_ID') && getCleanEnv('QUICKBOOKS_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://accounts.platform.intuit.com/v1/openid_connect/userinfo',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('QUICKBOOKS_CLIENT_ID') && getCleanEnv('QUICKBOOKS_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure QUICKBOOKS_CLIENT_ID & QUICKBOOKS_CLIENT_SECRET in Settings > Secrets'
  },
  {
    providerId: 'xero',
    providerName: 'Xero Cloud Accounting',
    category: 'Accounting & Finance',
    catalog: true,
    authStrategy: 'oauth2_standard',
    credentialsConfigured: Boolean(getCleanEnv('XERO_CLIENT_ID') && getCleanEnv('XERO_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.xero.com/connections',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('XERO_CLIENT_ID') && getCleanEnv('XERO_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure XERO_CLIENT_ID & XERO_CLIENT_SECRET in Settings > Secrets'
  },
  {
    providerId: 'netsuite',
    providerName: 'Oracle NetSuite ERP',
    category: 'Accounting & Finance',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('NETSUITE_ACCOUNT_ID') && getCleanEnv('NETSUITE_TOKEN_ID')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://{account}.suitetalk.api.netsuite.com/services/rest/record/v1/account',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('NETSUITE_ACCOUNT_ID') && getCleanEnv('NETSUITE_TOKEN_ID')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure NETSUITE_ACCOUNT_ID, NETSUITE_TOKEN_ID & NETSUITE_TOKEN_SECRET in Settings > Secrets'
  },
  {
    providerId: 'mercury',
    providerName: 'Mercury Commercial Banking',
    category: 'Accounting & Finance',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('MERCURY_API_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.mercury.com/api/v1/accounts',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('MERCURY_API_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure MERCURY_API_TOKEN in Settings > Secrets or in modal'
  },
  {
    providerId: 'ramp',
    providerName: 'Ramp Spend & Cards',
    category: 'Accounting & Finance',
    catalog: true,
    authStrategy: 'oauth2_standard',
    credentialsConfigured: Boolean(getCleanEnv('RAMP_CLIENT_ID') && getCleanEnv('RAMP_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.ramp.com/developer/v1/users/me',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('RAMP_CLIENT_ID') && getCleanEnv('RAMP_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure RAMP_CLIENT_ID & RAMP_CLIENT_SECRET in Settings > Secrets'
  },
  {
    providerId: 'brex',
    providerName: 'Brex Treasury & Spend',
    category: 'Accounting & Finance',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('BREX_API_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://platform.brexapis.com/v2/users/me',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('BREX_API_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure BREX_API_TOKEN in Settings > Secrets or in modal'
  },
  {
    providerId: 'billcom',
    providerName: 'Bill.com AP/AR Automation',
    category: 'Accounting & Finance',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('BILLCOM_API_KEY') && getCleanEnv('BILLCOM_ORG_ID')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'POST https://api.bill.com/api/v2/GetSessionInfo.json',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('BILLCOM_API_KEY') && getCleanEnv('BILLCOM_ORG_ID')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure BILLCOM_API_KEY & BILLCOM_ORG_ID in Settings > Secrets'
  },
  {
    providerId: 'sap',
    providerName: 'SAP S/4HANA ERP',
    category: 'Accounting & Finance',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('SAP_SERVICE_URL') && getCleanEnv('SAP_API_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET {SAP_SERVICE_URL}/sap/opu/odata/sap/API_FINANCIALDOCUMENT_SRV/$metadata',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('SAP_SERVICE_URL') && getCleanEnv('SAP_API_KEY')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure SAP_SERVICE_URL & SAP_API_KEY in Settings > Secrets'
  },
  {
    providerId: 'chargebee',
    providerName: 'Chargebee Subscription Billing',
    category: 'Accounting & Finance',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('CHARGEBEE_API_KEY') && getCleanEnv('CHARGEBEE_SITE')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://{site}.chargebee.com/api/v2/subscriptions',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('CHARGEBEE_API_KEY') && getCleanEnv('CHARGEBEE_SITE')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure CHARGEBEE_API_KEY & CHARGEBEE_SITE in Settings > Secrets'
  },

  // 3. Payments & Commerce
  {
    providerId: 'stripe',
    providerName: 'Stripe Billing & Payments',
    category: 'Payments & Commerce',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('STRIPE_SECRET_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.stripe.com/v1/balance',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('STRIPE_SECRET_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: getCleanEnv('STRIPE_SECRET_KEY') ? 'Ready to sync live ledger' : 'Configure STRIPE_SECRET_KEY in Settings > Secrets or enter key in modal'
  },
  {
    providerId: 'shopify',
    providerName: 'Shopify Merchant Commerce',
    category: 'Payments & Commerce',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('SHOPIFY_ACCESS_TOKEN') && getCleanEnv('SHOPIFY_STORE_DOMAIN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://{shop}.myshopify.com/admin/api/2024-01/shop.json',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('SHOPIFY_ACCESS_TOKEN') && getCleanEnv('SHOPIFY_STORE_DOMAIN')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure SHOPIFY_ACCESS_TOKEN & SHOPIFY_STORE_DOMAIN in Settings > Secrets'
  },
  {
    providerId: 'paypal',
    providerName: 'PayPal Commerce Platform',
    category: 'Payments & Commerce',
    catalog: true,
    authStrategy: 'oauth2_standard',
    credentialsConfigured: Boolean(getCleanEnv('PAYPAL_CLIENT_ID') && getCleanEnv('PAYPAL_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api-m.paypal.com/v1/identity/oauth2/userinfo',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('PAYPAL_CLIENT_ID') && getCleanEnv('PAYPAL_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure PAYPAL_CLIENT_ID & PAYPAL_CLIENT_SECRET in Settings > Secrets'
  },

  // 4. Email & Communication
  {
    providerId: 'gmail',
    providerName: 'Google Workspace Gmail',
    category: 'Email & Communication',
    catalog: true,
    authStrategy: 'oauth2_pkce',
    credentialsConfigured: Boolean(getCleanEnv('GOOGLE_CLIENT_ID') && getCleanEnv('GOOGLE_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://www.googleapis.com/oauth2/v2/userinfo',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('GOOGLE_CLIENT_ID') && getCleanEnv('GOOGLE_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Ready to initiate Google Workspace OAuth flow'
  },
  {
    providerId: 'slack',
    providerName: 'Slack Enterprise Grid',
    category: 'Email & Communication',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('SLACK_BOT_TOKEN') && getCleanEnv('SLACK_SIGNING_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'POST https://slack.com/api/auth.test',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('SLACK_BOT_TOKEN') && getCleanEnv('SLACK_SIGNING_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure SLACK_BOT_TOKEN & SLACK_SIGNING_SECRET in Settings > Secrets'
  },
  {
    providerId: 'msteams',
    providerName: 'Microsoft Teams',
    category: 'Email & Communication',
    catalog: true,
    authStrategy: 'oauth2_standard',
    credentialsConfigured: Boolean(getCleanEnv('MSTEAMS_CLIENT_ID') && getCleanEnv('MSTEAMS_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://graph.microsoft.com/v1.0/me',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('MSTEAMS_CLIENT_ID') && getCleanEnv('MSTEAMS_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure MSTEAMS_CLIENT_ID & MSTEAMS_CLIENT_SECRET in Settings > Secrets'
  },
  {
    providerId: 'outlook',
    providerName: 'Microsoft Outlook 365',
    category: 'Email & Communication',
    catalog: true,
    authStrategy: 'oauth2_standard',
    credentialsConfigured: Boolean(getCleanEnv('MICROSOFT_CLIENT_ID') && getCleanEnv('MICROSOFT_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://graph.microsoft.com/v1.0/me/mailfolders/inbox',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('MICROSOFT_CLIENT_ID') && getCleanEnv('MICROSOFT_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure MICROSOFT_CLIENT_ID & MICROSOFT_CLIENT_SECRET in Settings > Secrets'
  },
  {
    providerId: 'intercom',
    providerName: 'Intercom Customer Engagement',
    category: 'Email & Communication',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('INTERCOM_ACCESS_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.intercom.io/me',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('INTERCOM_ACCESS_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure INTERCOM_ACCESS_TOKEN in Settings > Secrets or in modal'
  },
  {
    providerId: 'resend',
    providerName: 'Resend Transactional Email',
    category: 'Email & Communication',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('RESEND_API_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.resend.com/api-keys',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('RESEND_API_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure RESEND_API_KEY in Settings > Secrets or in modal'
  },

  // 5. Calendars & Scheduling
  {
    providerId: 'google_calendar',
    providerName: 'Google Calendar',
    category: 'Calendars & Scheduling',
    catalog: true,
    authStrategy: 'oauth2_pkce',
    credentialsConfigured: Boolean(getCleanEnv('GOOGLE_CLIENT_ID') && getCleanEnv('GOOGLE_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://www.googleapis.com/calendar/v3/users/me/calendarList',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('GOOGLE_CLIENT_ID') && getCleanEnv('GOOGLE_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Ready to sync executive calendar schedules'
  },
  {
    providerId: 'calendly',
    providerName: 'Calendly Enterprise Scheduling',
    category: 'Calendars & Scheduling',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('CALENDLY_ACCESS_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.calendly.com/users/me',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('CALENDLY_ACCESS_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure CALENDLY_ACCESS_TOKEN in Settings > Secrets or in modal'
  },

  // 6. Customer Support
  {
    providerId: 'zendesk',
    providerName: 'Zendesk Support',
    category: 'Customer Support',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('ZENDESK_SUBDOMAIN') && getCleanEnv('ZENDESK_API_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://{subdomain}.zendesk.com/api/v2/users/me.json',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('ZENDESK_SUBDOMAIN') && getCleanEnv('ZENDESK_API_TOKEN')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure ZENDESK_SUBDOMAIN & ZENDESK_API_TOKEN in Settings > Secrets'
  },
  {
    providerId: 'freshdesk',
    providerName: 'Freshdesk Support',
    category: 'Customer Support',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('FRESHDESK_DOMAIN') && getCleanEnv('FRESHDESK_API_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://{domain}.freshdesk.com/api/v2/tickets',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('FRESHDESK_DOMAIN') && getCleanEnv('FRESHDESK_API_KEY')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure FRESHDESK_DOMAIN & FRESHDESK_API_KEY in Settings > Secrets'
  },
  {
    providerId: 'gainsight',
    providerName: 'Gainsight Customer Success',
    category: 'Customer Support',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('GAINSIGHT_ACCESS_KEY') && getCleanEnv('GAINSIGHT_DOMAIN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET https://{domain}.gainsightcloud.com/v1/companies',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('GAINSIGHT_ACCESS_KEY') && getCleanEnv('GAINSIGHT_DOMAIN')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure GAINSIGHT_ACCESS_KEY & GAINSIGHT_DOMAIN in Settings > Secrets'
  },
  {
    providerId: 'churnzero',
    providerName: 'ChurnZero Customer Success',
    category: 'Customer Support',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('CHURNZERO_APP_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET https://analytics.churnzero.net/api/v1/accounts',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('CHURNZERO_APP_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure CHURNZERO_APP_KEY in Settings > Secrets or in modal'
  },
  {
    providerId: 'pagerduty',
    providerName: 'PagerDuty Incident Response',
    category: 'Customer Support',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('PAGERDUTY_API_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.pagerduty.com/users/me',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('PAGERDUTY_API_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure PAGERDUTY_API_TOKEN in Settings > Secrets or in modal'
  },

  // 7. Project & Engineering
  {
    providerId: 'jira',
    providerName: 'Atlassian Jira Enterprise',
    category: 'Project & Engineering',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('JIRA_HOST') && getCleanEnv('JIRA_API_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://{jiraHost}/rest/api/3/myself',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('JIRA_HOST') && getCleanEnv('JIRA_API_TOKEN')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure JIRA_HOST & JIRA_API_TOKEN in Settings > Secrets'
  },
  {
    providerId: 'github',
    providerName: 'GitHub Enterprise',
    category: 'Project & Engineering',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('GITHUB_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.github.com/user',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('GITHUB_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: getCleanEnv('GITHUB_TOKEN') ? 'Ready to sync repo and PR velocity' : 'Configure GITHUB_TOKEN in Settings > Secrets or in modal'
  },
  {
    providerId: 'linear',
    providerName: 'Linear Velocity',
    category: 'Project & Engineering',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('LINEAR_API_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'POST https://api.linear.app/graphql { viewer { id name } }',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('LINEAR_API_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure LINEAR_API_KEY in Settings > Secrets or in modal'
  },
  {
    providerId: 'asana',
    providerName: 'Asana Project Management',
    category: 'Project & Engineering',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('ASANA_ACCESS_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://app.asana.com/api/1.0/users/me',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('ASANA_ACCESS_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure ASANA_ACCESS_TOKEN in Settings > Secrets or in modal'
  },
  {
    providerId: 'monday',
    providerName: 'Monday.com Work OS',
    category: 'Project & Engineering',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('MONDAY_API_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'POST https://api.monday.com/v2 { me { id name } }',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('MONDAY_API_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure MONDAY_API_TOKEN in Settings > Secrets or in modal'
  },
  {
    providerId: 'clickup',
    providerName: 'ClickUp Workspace',
    category: 'Project & Engineering',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('CLICKUP_API_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.clickup.com/api/v2/user',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('CLICKUP_API_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure CLICKUP_API_TOKEN in Settings > Secrets or in modal'
  },
  {
    providerId: 'gitlab',
    providerName: 'GitLab DevOps & CI/CD',
    category: 'Project & Engineering',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('GITLAB_PRIVATE_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://gitlab.com/api/v4/user',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('GITLAB_PRIVATE_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure GITLAB_PRIVATE_TOKEN in Settings > Secrets or in modal'
  },
  {
    providerId: 'figma',
    providerName: 'Figma Design Workspace',
    category: 'Project & Engineering',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('FIGMA_PERSONAL_ACCESS_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.figma.com/v1/me',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('FIGMA_PERSONAL_ACCESS_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure FIGMA_PERSONAL_ACCESS_TOKEN in Settings > Secrets or in modal'
  },

  // 8. Contracts & Documents
  {
    providerId: 'docusign',
    providerName: 'DocuSign E-Signature',
    category: 'Contracts & Documents',
    catalog: true,
    authStrategy: 'oauth2_standard',
    credentialsConfigured: Boolean(getCleanEnv('DOCUSIGN_INTEGRATION_KEY') && getCleanEnv('DOCUSIGN_USER_ID')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://account.docusign.com/oauth/userinfo',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('DOCUSIGN_INTEGRATION_KEY') && getCleanEnv('DOCUSIGN_USER_ID')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure DOCUSIGN_INTEGRATION_KEY & DOCUSIGN_USER_ID in Settings > Secrets'
  },
  {
    providerId: 'pandadoc',
    providerName: 'PandaDoc Document Automation',
    category: 'Contracts & Documents',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('PANDADOC_API_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.pandadoc.com/public/v1/documents',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('PANDADOC_API_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure PANDADOC_API_KEY in Settings > Secrets or in modal'
  },
  {
    providerId: 'ironclad',
    providerName: 'Ironclad Contract Lifecycle',
    category: 'Contracts & Documents',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('IRONCLAD_API_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://ironcladapp.com/api/v1/records',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('IRONCLAD_API_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure IRONCLAD_API_KEY in Settings > Secrets or in modal'
  },
  {
    providerId: 'notion',
    providerName: 'Notion Workspace Knowledge',
    category: 'Contracts & Documents',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('NOTION_API_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.notion.com/v1/users/me',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('NOTION_API_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure NOTION_API_KEY in Settings > Secrets or in modal'
  },
  {
    providerId: 'coda',
    providerName: 'Coda Collaborative Docs',
    category: 'Contracts & Documents',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('CODA_API_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://coda.io/apis/v1/whoami',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('CODA_API_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure CODA_API_TOKEN in Settings > Secrets or in modal'
  },
  {
    providerId: 'googledrive',
    providerName: 'Google Drive Workspace',
    category: 'Contracts & Documents',
    catalog: true,
    authStrategy: 'oauth2_pkce',
    credentialsConfigured: Boolean(getCleanEnv('GOOGLE_CLIENT_ID') && getCleanEnv('GOOGLE_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://www.googleapis.com/drive/v3/about?fields=user',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('GOOGLE_CLIENT_ID') && getCleanEnv('GOOGLE_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Ready to sync Google Drive files'
  },

  // 9. Analytics & Data
  {
    providerId: 'snowflake',
    providerName: 'Snowflake Data Cloud',
    category: 'Analytics & Data',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('SNOWFLAKE_ACCOUNT') && getCleanEnv('SNOWFLAKE_USER')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'POST https://{account}.snowflakecomputing.com/api/v2/statements',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('SNOWFLAKE_ACCOUNT') && getCleanEnv('SNOWFLAKE_USER')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure SNOWFLAKE_ACCOUNT & SNOWFLAKE_USER in Settings > Secrets'
  },
  {
    providerId: 'bigquery',
    providerName: 'Google BigQuery Warehouse',
    category: 'Analytics & Data',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('BIGQUERY_PROJECT_ID')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET https://bigquery.googleapis.com/bigquery/v2/projects/{projectId}/datasets',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('BIGQUERY_PROJECT_ID') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure BIGQUERY_PROJECT_ID in Settings > Secrets or in modal'
  },
  {
    providerId: 'databricks',
    providerName: 'Databricks Lakehouse',
    category: 'Analytics & Data',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('DATABRICKS_HOST') && getCleanEnv('DATABRICKS_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET {host}/api/2.0/clusters/list',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('DATABRICKS_HOST') && getCleanEnv('DATABRICKS_TOKEN')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure DATABRICKS_HOST & DATABRICKS_TOKEN in Settings > Secrets'
  },
  {
    providerId: 'segment',
    providerName: 'Twilio Segment CDP',
    category: 'Analytics & Data',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('SEGMENT_WRITE_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: true,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'POST https://api.segment.io/v1/track',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('SEGMENT_WRITE_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure SEGMENT_WRITE_KEY in Settings > Secrets or in modal'
  },
  {
    providerId: 'posthog',
    providerName: 'PostHog Product Analytics',
    category: 'Analytics & Data',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('POSTHOG_API_KEY') && getCleanEnv('POSTHOG_HOST')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET {host}/api/users/@me/',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('POSTHOG_API_KEY') && getCleanEnv('POSTHOG_HOST')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure POSTHOG_API_KEY & POSTHOG_HOST in Settings > Secrets'
  },
  {
    providerId: 'mixpanel',
    providerName: 'Mixpanel Product Analytics',
    category: 'Analytics & Data',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('MIXPANEL_PROJECT_TOKEN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET https://mixpanel.com/api/2.0/events/names',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('MIXPANEL_PROJECT_TOKEN') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure MIXPANEL_PROJECT_TOKEN in Settings > Secrets or in modal'
  },
  {
    providerId: 'datadog',
    providerName: 'Datadog Cloud Observability',
    category: 'Analytics & Data',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('DATADOG_API_KEY') && getCleanEnv('DATADOG_APP_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.datadoghq.com/api/v1/validate',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('DATADOG_API_KEY') && getCleanEnv('DATADOG_APP_KEY')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure DATADOG_API_KEY & DATADOG_APP_KEY in Settings > Secrets'
  },
  {
    providerId: 'sentry',
    providerName: 'Sentry Error & APM Tracking',
    category: 'Analytics & Data',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('SENTRY_AUTH_TOKEN') && getCleanEnv('SENTRY_ORG')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET https://sentry.io/api/0/users/me/',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('SENTRY_AUTH_TOKEN') && getCleanEnv('SENTRY_ORG')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure SENTRY_AUTH_TOKEN & SENTRY_ORG in Settings > Secrets'
  },
  {
    providerId: 'aws',
    providerName: 'AWS CloudWatch & FinOps',
    category: 'Analytics & Data',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('AWS_ACCESS_KEY_ID') && getCleanEnv('AWS_SECRET_ACCESS_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'POST https://sts.amazonaws.com/?Action=GetCallerIdentity',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('AWS_ACCESS_KEY_ID') && getCleanEnv('AWS_SECRET_ACCESS_KEY')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY in Settings > Secrets'
  },

  // 10. HR & Operations
  {
    providerId: 'workday',
    providerName: 'Workday HCM & Financials',
    category: 'HR & Operations',
    catalog: true,
    authStrategy: 'oauth2_standard',
    credentialsConfigured: Boolean(getCleanEnv('WORKDAY_CLIENT_ID') && getCleanEnv('WORKDAY_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://{workdayHost}/ccx/api/v1/{tenant}/workers',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('WORKDAY_CLIENT_ID') && getCleanEnv('WORKDAY_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure WORKDAY_CLIENT_ID, WORKDAY_CLIENT_SECRET & WORKDAY_TENANT in Settings > Secrets'
  },
  {
    providerId: 'rippling',
    providerName: 'Rippling Workforce Platform',
    category: 'HR & Operations',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('RIPPLING_API_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.rippling.com/platform/api/users/current',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('RIPPLING_API_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure RIPPLING_API_KEY in Settings > Secrets or in modal'
  },
  {
    providerId: 'deel',
    providerName: 'Deel Global Payroll & Contractors',
    category: 'HR & Operations',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('DEEL_API_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.letsdeel.com/rest/v1/legal-entities',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('DEEL_API_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure DEEL_API_KEY in Settings > Secrets or in modal'
  },
  {
    providerId: 'gusto',
    providerName: 'Gusto Modern Payroll',
    category: 'HR & Operations',
    catalog: true,
    authStrategy: 'oauth2_standard',
    credentialsConfigured: Boolean(getCleanEnv('GUSTO_CLIENT_ID') && getCleanEnv('GUSTO_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: true,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.gusto.com/v1/me',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('GUSTO_CLIENT_ID') && getCleanEnv('GUSTO_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure GUSTO_CLIENT_ID & GUSTO_CLIENT_SECRET in Settings > Secrets'
  },
  {
    providerId: 'bamboohr',
    providerName: 'BambooHR People Operations',
    category: 'HR & Operations',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('BAMBOOHR_API_KEY') && getCleanEnv('BAMBOOHR_SUBDOMAIN')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.bamboohr.com/api/gateway.php/{subdomain}/v1/employees/directory',
    webhookSupported: true,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('BAMBOOHR_API_KEY') && getCleanEnv('BAMBOOHR_SUBDOMAIN')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure BAMBOOHR_API_KEY & BAMBOOHR_SUBDOMAIN in Settings > Secrets'
  },

  // 11. Security & Compliance
  {
    providerId: 'vanta',
    providerName: 'Vanta Continuous Compliance',
    category: 'Security & Compliance',
    catalog: true,
    authStrategy: 'oauth2_standard',
    credentialsConfigured: Boolean(getCleanEnv('VANTA_CLIENT_ID') && getCleanEnv('VANTA_CLIENT_SECRET')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET https://api.vanta.com/v1/controls',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: (getCleanEnv('VANTA_CLIENT_ID') && getCleanEnv('VANTA_CLIENT_SECRET')) ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure VANTA_CLIENT_ID & VANTA_CLIENT_SECRET in Settings > Secrets'
  },
  {
    providerId: 'drata',
    providerName: 'Drata Compliance Automation',
    category: 'Security & Compliance',
    catalog: true,
    authStrategy: 'bearer_token',
    credentialsConfigured: Boolean(getCleanEnv('DRATA_API_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET https://public-api.drata.com/public/v1/workstations',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('DRATA_API_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure DRATA_API_KEY in Settings > Secrets or in modal'
  },
  {
    providerId: 'google_maps',
    providerName: 'Google Maps Platform',
    category: 'Analytics & Data',
    catalog: true,
    authStrategy: 'api_key_secret',
    credentialsConfigured: Boolean(getCleanEnv('GOOGLE_MAPS_API_KEY')),
    identityVerified: true,
    readCapable: true,
    syncVerified: true,
    businessGraphIngestion: true,
    aiDiscovery: true,
    mcpExposed: true,
    writeCapable: false,
    approvalRequired: false,
    idempotencySupported: true,
    verificationMethod: 'GET https://maps.googleapis.com/maps/api/geocode/json?address=San+Francisco&key={key}',
    webhookSupported: false,
    refreshSupported: true,
    disconnectSupported: true,
    mobileResponsive: true,
    status: getCleanEnv('GOOGLE_MAPS_API_KEY') ? 'SYNC_VERIFIED' : 'AUTH_READY',
    ownerAction: 'Configure GOOGLE_MAPS_API_KEY in Settings > Secrets or in modal'
  }
];

const DEV_PORTAL_MAP: Record<string, { portalUrl: string; scopes: string[]; guide: string[] }> = {
  salesforce: {
    portalUrl: 'https://login.salesforce.com',
    scopes: ['id', 'api', 'refresh_token'],
    guide: [
      'In Salesforce Setup, navigate to App Manager > New Connected App.',
      'Enable OAuth Settings and enter Callback URL: {CALLBACK_URL}',
      'Add Selected OAuth Scopes: Manage user data via APIs (api) and Perform requests at any time (refresh_token).',
      'Save the Connected App, copy Consumer Key and Secret to SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET.'
    ]
  },
  hubspot: {
    portalUrl: 'https://app.hubspot.com/developer',
    scopes: ['crm.objects.contacts.read', 'crm.objects.deals.read', 'crm.objects.companies.read'],
    guide: [
      'In HubSpot Developer Account, open Apps > Create App (or Create Private App in Settings).',
      'Add Redirect URL: {CALLBACK_URL}',
      'Select scopes: crm.objects.contacts.read and crm.objects.deals.read.',
      'Set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET or paste HUBSPOT_ACCESS_TOKEN into vault.'
    ]
  },
  gong: {
    portalUrl: 'https://app.gong.io/company/api',
    scopes: ['api:calls:read', 'api:transcripts:read'],
    guide: [
      'Log into Gong Admin Console > Company Settings > Ecosystem > API.',
      'Create an API Key and Secret with read access to calls and transcripts.',
      'Configure GONG_API_KEY and GONG_API_SECRET in SignalDesk.'
    ]
  },
  outreach: {
    portalUrl: 'https://accounts.outreach.io',
    scopes: ['prospects.read', 'sequences.read', 'mailings.read'],
    guide: [
      'In Outreach, go to Administration > Integrations > Apps > Create New App.',
      'Set Redirect URI: {CALLBACK_URL}',
      'Configure OUTREACH_CLIENT_ID and OUTREACH_CLIENT_SECRET in SignalDesk.'
    ]
  },
  salesloft: {
    portalUrl: 'https://accounts.salesloft.com',
    scopes: ['cadences:read', 'people:read', 'calls:read'],
    guide: [
      'In Salesloft, go to Settings > Your Applications > OAuth Applications.',
      'Generate an API Key or register OAuth credentials.',
      'Configure SALESLOFT_API_KEY in SignalDesk.'
    ]
  },
  apollo: {
    portalUrl: 'https://app.apollo.io/#/settings/integrations/api',
    scopes: ['contacts:read', 'organizations:read'],
    guide: [
      'Open Apollo.io > Settings > Integrations > API Keys.',
      'Click Create Master API Key.',
      'Configure APOLLO_API_KEY in SignalDesk.'
    ]
  },
  zoominfo: {
    portalUrl: 'https://developer.zoominfo.com',
    scopes: ['enterprise:enrichment', 'intent:read'],
    guide: [
      'Access ZoomInfo Admin Portal > Integrations > API Management.',
      'Generate API Client ID and Private Key.',
      'Configure ZOOMINFO_USERNAME and ZOOMINFO_CLIENT_ID.'
    ]
  },
  pipedrive: {
    portalUrl: 'https://app.pipedrive.com/settings/api',
    scopes: ['deals:read', 'activities:read', 'organizations:read'],
    guide: [
      'In Pipedrive, go to Personal Preferences > API.',
      'Copy your Personal API Token.',
      'Configure PIPEDRIVE_API_TOKEN in SignalDesk.'
    ]
  },
  quickbooks: {
    portalUrl: 'https://developer.intuit.com',
    scopes: ['com.intuit.quickbooks.accounting', 'openid', 'email'],
    guide: [
      'Go to Intuit Developer Portal > Dashboard > Your App > Keys & OAuth.',
      'Add Redirect URI: {CALLBACK_URL}',
      'Copy Client ID and Client Secret to QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET.'
    ]
  },
  xero: {
    portalUrl: 'https://developer.xero.com/app/manage',
    scopes: ['accounting.transactions.read', 'accounting.contacts.read', 'offline_access'],
    guide: [
      'Visit Xero Developer Portal > My Apps > New App.',
      'Choose "Web app" and enter OAuth 2.0 redirect URI: {CALLBACK_URL}',
      'Configure XERO_CLIENT_ID and XERO_CLIENT_SECRET in SignalDesk.'
    ]
  },
  netsuite: {
    portalUrl: 'https://www.netsuite.com/portal/developers',
    scopes: ['rest_webservices', 'tba'],
    guide: [
      'In NetSuite, enable SuiteTalk Web Services and Token-Based Authentication.',
      'Create Integration Record and issue Access Token & Token Secret.',
      'Configure NETSUITE_ACCOUNT_ID, NETSUITE_TOKEN_ID, and NETSUITE_TOKEN_SECRET.'
    ]
  },
  mercury: {
    portalUrl: 'https://mercury.com',
    scopes: ['accounts:read', 'transactions:read'],
    guide: [
      'Log in to Mercury > Settings > API Access.',
      'Generate a Read-Only API Token for account and transaction monitoring.',
      'Configure MERCURY_API_KEY in SignalDesk.'
    ]
  },
  ramp: {
    portalUrl: 'https://ramp.com/developer',
    scopes: ['cards:read', 'transactions:read', 'spending_limits:read'],
    guide: [
      'In Ramp Settings > Developer > API Access, create a new API client.',
      'Configure RAMP_CLIENT_ID and RAMP_CLIENT_SECRET in SignalDesk.'
    ]
  },
  brex: {
    portalUrl: 'https://dashboard.brex.com/settings/developer',
    scopes: ['accounts:read', 'transactions:read', 'transfers:read'],
    guide: [
      'Navigate to Brex Dashboard > Settings > Developer > Create User API Token.',
      'Select read scopes on accounts and transactions.',
      'Configure BREX_API_KEY in SignalDesk.'
    ]
  },
  billcom: {
    portalUrl: 'https://developer.bill.com',
    scopes: ['invoices:read', 'payments:read'],
    guide: [
      'In Bill.com Developer Console, create an organization developer key.',
      'Configure BILLCOM_API_KEY and BILLCOM_ORG_ID in SignalDesk.'
    ]
  },
  sap: {
    portalUrl: 'https://api.sap.com',
    scopes: ['business_partner:read', 'financial_accounting:read'],
    guide: [
      'Access SAP Business Technology Platform (BTP) Cockpit.',
      'Create a Service Binding for S/4HANA Cloud OData APIs.',
      'Configure SAP_OAUTH_CLIENT_ID and SAP_OAUTH_SECRET in SignalDesk.'
    ]
  },
  chargebee: {
    portalUrl: 'https://app.chargebee.com',
    scopes: ['subscriptions:read', 'invoices:read', 'customers:read'],
    guide: [
      'Go to Chargebee Settings > Configure Chargebee > API Keys.',
      'Create a Read-Only API Key.',
      'Configure CHARGEBEE_API_KEY and CHARGEBEE_SITE_NAME in SignalDesk.'
    ]
  },
  stripe: {
    portalUrl: 'https://dashboard.stripe.com/apikeys',
    scopes: ['rak_charge_read', 'rak_customer_read', 'rak_invoice_read', 'rak_subscription_read'],
    guide: [
      'Go to Stripe Dashboard > Developers > API keys.',
      'Create a Restricted Key with Read permissions on Balances, Customers, Invoices, Subscriptions.',
      'Enter the Restricted API Key directly into SignalDesk vault or set STRIPE_SECRET_KEY.'
    ]
  },
  shopify: {
    portalUrl: 'https://partners.shopify.com',
    scopes: ['read_orders', 'read_products', 'read_customers'],
    guide: [
      'In Shopify Admin > Apps and sales channels > Develop apps > Create an app.',
      'Configure Admin API scopes: read_orders, read_products, read_customers.',
      'Install app and copy Admin API access token to SHOPIFY_ACCESS_TOKEN.'
    ]
  },
  paypal: {
    portalUrl: 'https://developer.paypal.com',
    scopes: ['payments:read', 'disputes:read'],
    guide: [
      'In PayPal Developer Dashboard, navigate to My Apps & Credentials.',
      'Create an App under REST API apps.',
      'Configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in SignalDesk.'
    ]
  },
  gmail: {
    portalUrl: 'https://console.cloud.google.com/apis/credentials',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    guide: [
      'Open Google Cloud Console > APIs & Services > Credentials.',
      'Create OAuth 2.0 Client ID for Web Applications with Callback: {CALLBACK_URL}',
      'Enable Gmail API in Enabled APIs & Services.',
      'Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in SignalDesk.'
    ]
  },
  slack: {
    portalUrl: 'https://api.slack.com/apps',
    scopes: ['channels:read', 'groups:read', 'channels:history'],
    guide: [
      'Visit api.slack.com/apps and select or create your SignalDesk Slack App.',
      'Go to OAuth & Permissions and add Redirect URL: {CALLBACK_URL}',
      'Add Bot Token Scopes: channels:read, groups:read, channels:history.',
      'Configure SLACK_CLIENT_ID and SLACK_CLIENT_SECRET (or SLACK_BOT_TOKEN).'
    ]
  },
  msteams: {
    portalUrl: 'https://portal.azure.com',
    scopes: ['ChannelMessage.Read.All', 'Team.ReadBasic.All', 'User.Read'],
    guide: [
      'In Azure Active Directory > App registrations, register a new application.',
      'Add Web Redirect URI: {CALLBACK_URL}',
      'Add Microsoft Graph API Application permissions: ChannelMessage.Read.All.',
      'Configure TEAMS_CLIENT_ID and TEAMS_CLIENT_SECRET in SignalDesk.'
    ]
  },
  outlook: {
    portalUrl: 'https://portal.azure.com',
    scopes: ['Mail.Read', 'Calendars.Read', 'offline_access'],
    guide: [
      'In Azure Portal > Azure AD > App registrations > Create App.',
      'Add Web Redirect URI: {CALLBACK_URL}',
      'Grant Mail.Read and Calendars.Read permissions.',
      'Configure OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET in SignalDesk.'
    ]
  },
  intercom: {
    portalUrl: 'https://developers.intercom.com',
    scopes: ['conversations:read', 'contacts:read'],
    guide: [
      'In Intercom Developer Hub, select your app > Authentication.',
      'Set Redirect URL: {CALLBACK_URL}',
      'Configure INTERCOM_ACCESS_TOKEN or OAuth Client credentials.'
    ]
  },
  resend: {
    portalUrl: 'https://resend.com/api-keys',
    scopes: ['email:send', 'domains:read'],
    guide: [
      'Go to Resend Dashboard > API Keys > Create API Key.',
      'Select Full Access or Sending Access.',
      'Configure RESEND_API_KEY in server environment or enter it into the vault.'
    ]
  },
  google_calendar: {
    portalUrl: 'https://console.cloud.google.com/apis/credentials',
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    guide: [
      'Open Google Cloud Console > APIs & Services > Credentials.',
      'Create OAuth Client ID for Web Applications with Callback: {CALLBACK_URL}',
      'Enable Google Calendar API in APIs & Services.',
      'Configure GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET.'
    ]
  },
  calendly: {
    portalUrl: 'https://developer.calendly.com',
    scopes: ['default'],
    guide: [
      'In Calendly Integrations > API & Webhooks, generate a Personal Access Token.',
      'Configure CALENDLY_API_KEY in SignalDesk.'
    ]
  },
  zendesk: {
    portalUrl: 'https://support.zendesk.com',
    scopes: ['read'],
    guide: [
      'In Zendesk Admin Center, go to Apps and Integrations > APIs > Zendesk API > OAuth Clients.',
      'Add OAuth Client with Redirect URL: {CALLBACK_URL}',
      'Set ZENDESK_SUBDOMAIN, ZENDESK_CLIENT_ID, and ZENDESK_CLIENT_SECRET in SignalDesk.',
      'Alternatively, enable Token Access in Zendesk API settings and enter your API Token and Email.'
    ]
  },
  freshdesk: {
    portalUrl: 'https://developers.freshdesk.com',
    scopes: ['tickets:read', 'contacts:read'],
    guide: [
      'In Freshdesk Profile Settings > Your API Key, copy your unique key.',
      'Configure FRESHDESK_DOMAIN and FRESHDESK_API_KEY in SignalDesk.'
    ]
  },
  gainsight: {
    portalUrl: 'https://support.gainsight.com',
    scopes: ['company:read', 'healthscore:read', 'cta:read'],
    guide: [
      'In Gainsight Administration > Connectors 2.0 > Generate API Access Key.',
      'Configure GAINSIGHT_API_KEY and GAINSIGHT_DOMAIN in SignalDesk.'
    ]
  },
  churnzero: {
    portalUrl: 'https://churnzero.com',
    scopes: ['accounts:read', 'churn_risk:read'],
    guide: [
      'Contact your ChurnZero account administrator to generate an App Key.',
      'Configure CHURNZERO_APP_KEY in SignalDesk.'
    ]
  },
  pagerduty: {
    portalUrl: 'https://support.pagerduty.com/docs/api-access-keys',
    scopes: ['incidents:read', 'services:read'],
    guide: [
      'In PagerDuty, navigate to Integrations > API Access Keys > Create New API Key.',
      'Select Read-only access.',
      'Configure PAGERDUTY_API_KEY in SignalDesk.'
    ]
  },
  jira: {
    portalUrl: 'https://developer.atlassian.com/console/myapps/',
    scopes: ['read:jira-work', 'read:jira-user', 'offline_access'],
    guide: [
      'Visit Atlassian Developer Console > Create App > OAuth 2.0 (3LO).',
      'Add Callback URL: {CALLBACK_URL}',
      'Add Permissions: Jira platform REST API (read:jira-work, read:jira-user).',
      'Configure JIRA_CLIENT_ID and JIRA_CLIENT_SECRET in SignalDesk.'
    ]
  },
  github: {
    portalUrl: 'https://github.com/settings/developers',
    scopes: ['read:user', 'user:email', 'repo:status', 'read:org'],
    guide: [
      'In GitHub, go to Settings > Developer settings > OAuth Apps > New OAuth App.',
      'Set Authorization callback URL to {CALLBACK_URL}',
      'Generate a Client Secret.',
      'Configure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in SignalDesk.'
    ]
  },
  linear: {
    portalUrl: 'https://linear.app/settings/api',
    scopes: ['read', 'issues:create'],
    guide: [
      'Open Linear Settings > Workspace > API > OAuth Applications.',
      'Create an application and register Redirect URI: {CALLBACK_URL}',
      'Set LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET in SignalDesk.',
      'Or generate a Personal API Key from Linear Settings > Account > API and enter it into the vault.'
    ]
  },
  asana: {
    portalUrl: 'https://app.asana.com/0/developer-console',
    scopes: ['default'],
    guide: [
      'Open Asana Developer Console > New App.',
      'Add Redirect URL: {CALLBACK_URL}',
      'Copy Client ID and Client Secret to ASANA_CLIENT_ID and ASANA_CLIENT_SECRET in SignalDesk.'
    ]
  },
  monday: {
    portalUrl: 'https://developer.monday.com',
    scopes: ['boards:read', 'workspaces:read', 'users:read'],
    guide: [
      'In Monday.com, click your profile picture > Developers > My Apps > Create App.',
      'Add Redirect URL: {CALLBACK_URL}',
      'Configure MONDAY_CLIENT_ID and MONDAY_CLIENT_SECRET or set MONDAY_API_TOKEN.'
    ]
  },
  clickup: {
    portalUrl: 'https://app.clickup.com/settings/apps',
    scopes: ['tasks:read', 'spaces:read'],
    guide: [
      'In ClickUp Settings > Integrations > ClickUp API > Create App.',
      'Set Redirect URL: {CALLBACK_URL}',
      'Configure CLICKUP_CLIENT_ID and CLICKUP_CLIENT_SECRET or paste personal API token.'
    ]
  },
  gitlab: {
    portalUrl: 'https://gitlab.com/-/profile/applications',
    scopes: ['read_user', 'read_api', 'read_repository'],
    guide: [
      'In GitLab User Settings > Applications > Add new application.',
      'Set Redirect URI: {CALLBACK_URL}',
      'Check read_api and read_repository scopes.',
      'Configure GITLAB_CLIENT_ID and GITLAB_CLIENT_SECRET in SignalDesk.'
    ]
  },
  figma: {
    portalUrl: 'https://www.figma.com/developers/api',
    scopes: ['file_read'],
    guide: [
      'In Figma Account Settings > Personal access tokens, generate a new token.',
      'Configure FIGMA_ACCESS_TOKEN in SignalDesk.'
    ]
  },
  docusign: {
    portalUrl: 'https://admindemo.docusign.com',
    scopes: ['signature', 'extended'],
    guide: [
      'In DocuSign eSignature Admin > Settings > Apps and Keys > Add App and Integration Key.',
      'Add Redirect URI: {CALLBACK_URL}',
      'Configure DOCUSIGN_CLIENT_ID and DOCUSIGN_CLIENT_SECRET in SignalDesk.'
    ]
  },
  pandadoc: {
    portalUrl: 'https://app.pandadoc.com',
    scopes: ['read:documents'],
    guide: [
      'In PandaDoc Settings > Developer Dashboard > Create API Key.',
      'Configure PANDADOC_API_KEY in SignalDesk.'
    ]
  },
  ironclad: {
    portalUrl: 'https://ironcladapp.com',
    scopes: ['workflows:read', 'records:read'],
    guide: [
      'In Ironclad Company Settings > Integrations > API Keys > Generate Key.',
      'Configure IRONCLAD_API_KEY in SignalDesk.'
    ]
  },
  notion: {
    portalUrl: 'https://www.notion.so/my-integrations',
    scopes: ['read_content', 'read_user_info'],
    guide: [
      'Open notion.so/my-integrations > New Integration.',
      'Select Read content capability.',
      'Copy Internal Integration Secret to NOTION_API_KEY in SignalDesk.'
    ]
  },
  coda: {
    portalUrl: 'https://coda.io/account',
    scopes: ['doc:read'],
    guide: [
      'In Coda Account Settings > API Settings > Generate API token.',
      'Configure CODA_API_KEY in SignalDesk.'
    ]
  },
  googledrive: {
    portalUrl: 'https://console.cloud.google.com/apis/credentials',
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    guide: [
      'In Google Cloud Console > Credentials, create OAuth 2.0 Client ID.',
      'Add Redirect URI: {CALLBACK_URL}',
      'Enable Google Drive API.',
      'Configure GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET in SignalDesk.'
    ]
  },
  snowflake: {
    portalUrl: 'https://app.snowflake.com',
    scopes: ['session:role-any'],
    guide: [
      'In Snowflake Admin Console, create a service user with read privileges.',
      'Generate Key Pair or password authentication.',
      'Configure SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, and SNOWFLAKE_PASSWORD in SignalDesk.'
    ]
  },
  bigquery: {
    portalUrl: 'https://console.cloud.google.com/bigquery',
    scopes: ['https://www.googleapis.com/auth/bigquery.readonly'],
    guide: [
      'In GCP Console > IAM & Admin > Service Accounts, create a Service Account.',
      'Assign BigQuery Data Viewer role and generate JSON Key.',
      'Configure BIGQUERY_PROJECT_ID and BIGQUERY_CREDENTIALS in SignalDesk.'
    ]
  },
  databricks: {
    portalUrl: 'https://accounts.cloud.databricks.com',
    scopes: ['sql:read'],
    guide: [
      'In Databricks Workspace > User Settings > Access tokens > Generate new token.',
      'Configure DATABRICKS_HOST and DATABRICKS_TOKEN in SignalDesk.'
    ]
  },
  segment: {
    portalUrl: 'https://app.segment.com',
    scopes: ['tracking:read'],
    guide: [
      'In Segment Workspace > Settings > Workspace API Access > Create Token.',
      'Configure SEGMENT_WRITE_KEY or API access token in SignalDesk.'
    ]
  },
  posthog: {
    portalUrl: 'https://us.posthog.com/settings/project',
    scopes: ['project:read', 'events:read'],
    guide: [
      'In PostHog Project Settings > Project API Key & Personal API Keys.',
      'Create Personal API Key with read permissions.',
      'Configure POSTHOG_API_KEY in SignalDesk.'
    ]
  },
  mixpanel: {
    portalUrl: 'https://mixpanel.com/project-settings',
    scopes: ['insights:read'],
    guide: [
      'In Mixpanel Project Settings > Service Accounts > Add Service Account.',
      'Configure MIXPANEL_PROJECT_ID, MIXPANEL_SECRET in SignalDesk.'
    ]
  },
  datadog: {
    portalUrl: 'https://app.datadoghq.com/organization-settings/api-keys',
    scopes: ['monitors:read', 'metrics:read'],
    guide: [
      'In Datadog Organization Settings > API Keys & Application Keys.',
      'Generate API Key and Application Key with read permissions.',
      'Configure DATADOG_API_KEY and DATADOG_APP_KEY in SignalDesk.'
    ]
  },
  sentry: {
    portalUrl: 'https://sentry.io/settings/account/api/auth-tokens',
    scopes: ['project:read', 'event:read'],
    guide: [
      'In Sentry User Settings > API > Auth Tokens > Create New Token.',
      'Select project:read and event:read scopes.',
      'Configure SENTRY_AUTH_TOKEN in SignalDesk.'
    ]
  },
  aws: {
    portalUrl: 'https://console.aws.amazon.com/iam',
    scopes: ['cloudwatch:GetMetricData', 'ec2:DescribeInstances', 'cost-explorer:GetCostAndUsage'],
    guide: [
      'In AWS IAM Console, create a dedicated SignalDesk Read-Only IAM User or Role.',
      'Attach CloudWatchReadOnlyAccess and AWSCostAndUsageReportAutomationPolicy policies.',
      'Configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in SignalDesk.'
    ]
  },
  workday: {
    portalUrl: 'https://community.workday.com',
    scopes: ['staffing:read', 'compensation:read'],
    guide: [
      'In Workday Tenant Setup, register API Client for Integrations.',
      'Issue ISU (Integration System User) credentials and OAuth Bearer tokens.',
      'Configure WORKDAY_CLIENT_ID and WORKDAY_CLIENT_SECRET in SignalDesk.'
    ]
  },
  rippling: {
    portalUrl: 'https://app.rippling.com',
    scopes: ['employees:read', 'departments:read'],
    guide: [
      'In Rippling App Shop > Custom API Integration > Generate API Token.',
      'Configure RIPPLING_API_KEY in SignalDesk.'
    ]
  },
  deel: {
    portalUrl: 'https://app.deel.com',
    scopes: ['contracts:read', 'invoices:read', 'people:read'],
    guide: [
      'In Deel Organization Settings > Developer Center > Generate API Access Token.',
      'Configure DEEL_API_KEY in SignalDesk.'
    ]
  },
  gusto: {
    portalUrl: 'https://dev.gusto.com',
    scopes: ['payrolls:read', 'company:read', 'employees:read'],
    guide: [
      'In Gusto Developer Portal > Applications > Create Application.',
      'Set Redirect URI: {CALLBACK_URL}',
      'Configure GUSTO_CLIENT_ID and GUSTO_CLIENT_SECRET in SignalDesk.'
    ]
  },
  bamboohr: {
    portalUrl: 'https://documentation.bamboohr.com',
    scopes: ['employee_records:read'],
    guide: [
      'In BambooHR User Profile > API Keys > Add New Key.',
      'Configure BAMBOOHR_API_KEY and BAMBOOHR_SUBDOMAIN in SignalDesk.'
    ]
  },
  vanta: {
    portalUrl: 'https://app.vanta.com',
    scopes: ['controls:read', 'tests:read', 'vendors:read'],
    guide: [
      'In Vanta Settings > Developer Console > Manage API Tokens.',
      'Create Token with read permissions on security tests and controls.',
      'Configure VANTA_API_KEY in SignalDesk.'
    ]
  },
  drata: {
    portalUrl: 'https://app.drata.com',
    scopes: ['compliance:read', 'workstations:read', 'personnel:read'],
    guide: [
      'In Drata Company Settings > Developer API > Generate API Key.',
      'Configure DRATA_API_KEY in SignalDesk.'
    ]
  },
  google_maps: {
    portalUrl: 'https://console.cloud.google.com/google/maps-apis/credentials',
    scopes: ['Geocoding API', 'Routes API', 'Places API'],
    guide: [
      'Open Google Cloud Console > Google Maps Platform > Credentials.',
      'Generate an API Key restricted to Geocoding, Places, and Routes APIs.',
      'Configure GOOGLE_MAPS_API_KEY in server environment or enter it into the vault.'
    ]
  }
};

export const OWNER_SETUP_MATRIX_57: OwnerSetupMatrixEntry[] = CONNECTOR_REALITY_MATRIX_57.map(item => {
  const cat = CONNECTOR_CATALOG_57.find(c => c.id === item.providerId);
  const devMeta = DEV_PORTAL_MAP[item.providerId] || {
    portalUrl: `https://${item.providerId}.com/developers`,
    scopes: ['read'],
    guide: [
      `Sign in to your ${item.providerName} developer console.`,
      `Generate API credentials or configure OAuth with callback: {CALLBACK_URL}`,
      `Configure the required environment variables in SignalDesk.`
    ]
  };

  const reqEnv = cat?.requiredEnvVars || (item.authStrategy.includes('oauth') 
    ? [`${item.providerId.toUpperCase()}_CLIENT_ID`, `${item.providerId.toUpperCase()}_CLIENT_SECRET`]
    : [`${item.providerId.toUpperCase()}_API_KEY`]);

  const vaultKey = reqEnv[reqEnv.length - 1] || `${item.providerId.toUpperCase()}_API_KEY`;

  const cleanEndpoint = item.verificationMethod.replace(/^[A-Z]+\s+/, '');

  return {
    providerId: item.providerId,
    providerName: item.providerName,
    category: item.category,
    authType: item.authStrategy === 'oauth2_pkce' ? 'OAuth 2.0 (PKCE)' :
              item.authStrategy === 'oauth2_standard' ? 'OAuth 2.0 (Confidential)' :
              item.authStrategy === 'bearer_token' ? 'Bearer Token' :
              item.authStrategy === 'api_key_secret' ? 'API Key / Secret' : 'API Key Vault',
    developerPortalUrl: devMeta.portalUrl,
    canonicalCallbackUrl: 'https://ais-dev-62pwdxf3jegq4yodmb42gy-423433823926.us-west2.run.app/auth/callback',
    requiredScopes: devMeta.scopes,
    requiredEnvVars: reqEnv,
    vaultSecretKey: vaultKey,
    identityVerificationEndpoint: cleanEndpoint,
    readVerificationEndpoints: [cleanEndpoint],
    setupGuide: devMeta.guide
  };
});
