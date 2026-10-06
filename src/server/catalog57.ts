import { ConnectorCatalogEntry } from '../types';
import { getCleanEnv } from './cleanEnv';

export const CONNECTOR_CATALOG_57: ConnectorCatalogEntry[] = [
  // =========================================================================
  // 1. CRM & REVENUE (8)
  // =========================================================================
  {
    id: 'salesforce',
    name: 'Salesforce Enterprise CRM',
    category: 'CRM & Revenue',
    icon: 'layers',
    description: 'System of record for enterprise pipeline opportunities, ARR contract stages, and accounts.',
    authMethod: 'oauth2_standard',
    requiredEnvVars: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET'],
    capabilities: ['read_opportunities', 'read_accounts', 'read_contacts', 'stage_opportunity_update'],
    contributedEntities: ['Accounts', 'Opportunities', 'Leads', 'Contacts'],
    dataFreshnessModel: 'CDC Streaming Events + 15m Sync',
    functionalStatus: (getCleanEnv('SALESFORCE_CLIENT_ID') && getCleanEnv('SALESFORCE_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'hubspot',
    name: 'HubSpot CRM & Growth',
    category: 'CRM & Revenue',
    icon: 'users',
    description: 'Inbound marketing leads, sales pipeline, deal stage velocity, and customer communications.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['HUBSPOT_ACCESS_TOKEN'],
    capabilities: ['read_deals', 'read_companies', 'read_contacts'],
    contributedEntities: ['Deals', 'Marketing Leads', 'Contacts'],
    dataFreshnessModel: 'Webhook + 15m Sync',
    functionalStatus: getCleanEnv('HUBSPOT_ACCESS_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'gong',
    name: 'Gong Revenue Intelligence',
    category: 'CRM & Revenue',
    icon: 'radio',
    description: 'Executive conversation intelligence, customer objection tracking, and deal health forecasting.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['GONG_API_KEY', 'GONG_API_SECRET'],
    capabilities: ['read_calls', 'read_transcripts', 'detect_competitor_mentions'],
    contributedEntities: ['Sales Calls', 'Objection Signals', 'Deal Sentiment'],
    dataFreshnessModel: 'Post-Call Ingestion (Hourly)',
    functionalStatus: (getCleanEnv('GONG_API_KEY') && getCleanEnv('GONG_API_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'outreach',
    name: 'Outreach Sales Execution',
    category: 'CRM & Revenue',
    icon: 'mail',
    description: 'Enterprise outbound sequences, buyer engagement tracking, and rep meeting touchpoints.',
    authMethod: 'oauth2_standard',
    requiredEnvVars: ['OUTREACH_CLIENT_ID', 'OUTREACH_CLIENT_SECRET'],
    capabilities: ['read_prospects', 'read_sequences', 'read_mailings'],
    contributedEntities: ['Prospects', 'Active Sequences', 'Rep Activities'],
    dataFreshnessModel: 'Event Webhook + 30m Sync',
    functionalStatus: (getCleanEnv('OUTREACH_CLIENT_ID') && getCleanEnv('OUTREACH_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'salesloft',
    name: 'Salesloft Revenue Orchestration',
    category: 'CRM & Revenue',
    icon: 'trending-up',
    description: 'Sales cadence execution, pipeline engagement signals, and conversation analytics.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['SALESLOFT_API_KEY'],
    capabilities: ['read_cadences', 'read_people', 'read_calls'],
    contributedEntities: ['Cadences', 'Active Prospects', 'Engagement Logs'],
    dataFreshnessModel: 'Hourly Polling',
    functionalStatus: getCleanEnv('SALESLOFT_API_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'apollo',
    name: 'Apollo.io B2B Intelligence',
    category: 'CRM & Revenue',
    icon: 'search',
    description: 'B2B contact enrichment, verified corporate emails, buyer intent signals, and account sizing.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['APOLLO_API_KEY'],
    capabilities: ['enrich_contacts', 'read_organizations', 'verify_emails'],
    contributedEntities: ['Enriched Leads', 'Company Profiles', 'Intent Alerts'],
    dataFreshnessModel: 'On-Demand Enrichment',
    functionalStatus: getCleanEnv('APOLLO_API_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'zoominfo',
    name: 'ZoomInfo Enterprise Intelligence',
    category: 'CRM & Revenue',
    icon: 'database',
    description: 'Firmographic corporate hierarchies, executive org charts, and enterprise buying signals.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['ZOOMINFO_USERNAME', 'ZOOMINFO_CLIENT_ID'],
    capabilities: ['search_companies', 'read_intent_spikes', 'read_technographics'],
    contributedEntities: ['Corporate Hierarchies', 'Intent Surges', 'Technographic Stacks'],
    dataFreshnessModel: 'Daily Batch Sync',
    functionalStatus: (getCleanEnv('ZOOMINFO_USERNAME') && getCleanEnv('ZOOMINFO_CLIENT_ID')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive CRM',
    category: 'CRM & Revenue',
    icon: 'layers',
    description: 'Activity-based sales management, deal stage progression, and customer interaction logs.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['PIPEDRIVE_API_TOKEN'],
    capabilities: ['read_deals', 'read_activities', 'read_organizations'],
    contributedEntities: ['Pipeline Deals', 'Sales Activities', 'Client Accounts'],
    dataFreshnessModel: 'Webhook + Polling',
    functionalStatus: getCleanEnv('PIPEDRIVE_API_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },

  // =========================================================================
  // 2. ACCOUNTING & FINANCE (9)
  // =========================================================================
  {
    id: 'quickbooks',
    name: 'QuickBooks Enterprise',
    category: 'Accounting & Finance',
    icon: 'file-text',
    description: 'General ledger, accounts receivable aging, payment reconciliation, and vendor bills.',
    authMethod: 'oauth2_standard',
    requiredEnvVars: ['QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET'],
    capabilities: ['read_invoices', 'read_accounts_receivable', 'read_bills', 'read_chart_of_accounts'],
    contributedEntities: ['Invoices', 'AR Aging Reports', 'Vendor Bills'],
    dataFreshnessModel: 'Daily Financial Reconciliation + Hourly Polling',
    functionalStatus: (getCleanEnv('QUICKBOOKS_CLIENT_ID') && getCleanEnv('QUICKBOOKS_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'xero',
    name: 'Xero Cloud Accounting',
    category: 'Accounting & Finance',
    icon: 'file-text',
    description: 'Global invoicing, multi-currency ledger, bank feed reconciliation, and cashflow tracking.',
    authMethod: 'oauth2_standard',
    requiredEnvVars: ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET'],
    capabilities: ['read_invoices', 'read_bank_transactions', 'read_tax_rates'],
    contributedEntities: ['Invoices', 'Bank Statements', 'Tax Schedules'],
    dataFreshnessModel: 'Daily Sync + Webhooks',
    functionalStatus: (getCleanEnv('XERO_CLIENT_ID') && getCleanEnv('XERO_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'netsuite',
    name: 'Oracle NetSuite ERP',
    category: 'Accounting & Finance',
    icon: 'database',
    description: 'Enterprise ERP ledger, multi-entity subsidiary consolidation, and purchase orders.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['NETSUITE_ACCOUNT_ID', 'NETSUITE_TOKEN_ID', 'NETSUITE_TOKEN_SECRET'],
    capabilities: ['read_general_ledger', 'read_purchase_orders', 'read_subsidiaries'],
    contributedEntities: ['General Ledger Entries', 'Purchase Orders', 'Subsidiary Entities'],
    dataFreshnessModel: 'Hourly Financial Sync',
    functionalStatus: (getCleanEnv('NETSUITE_ACCOUNT_ID') && getCleanEnv('NETSUITE_TOKEN_ID')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'mercury',
    name: 'Mercury Commercial Banking',
    category: 'Accounting & Finance',
    icon: 'credit-card',
    description: 'Direct commercial treasury feeds, operating account cash balances, and domestic wires.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['MERCURY_API_TOKEN'],
    capabilities: ['read_balances', 'read_transactions', 'read_recipients'],
    contributedEntities: ['Liquid Cash Balances', 'Banking Transactions', 'Wire Receipts'],
    dataFreshnessModel: 'Daily Real-time Feed',
    functionalStatus: getCleanEnv('MERCURY_API_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'ramp',
    name: 'Ramp Spend & Cards',
    category: 'Accounting & Finance',
    icon: 'credit-card',
    description: 'Corporate cards, automated receipt matching, travel policy controls, and spend limits.',
    authMethod: 'oauth2_standard',
    requiredEnvVars: ['RAMP_CLIENT_ID', 'RAMP_CLIENT_SECRET'],
    capabilities: ['read_card_transactions', 'read_reimbursements', 'read_limits'],
    contributedEntities: ['Corporate Spend Records', 'Card Authorizations', 'Expense Outliers'],
    dataFreshnessModel: 'Instant Card Webhook',
    functionalStatus: (getCleanEnv('RAMP_CLIENT_ID') && getCleanEnv('RAMP_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'brex',
    name: 'Brex Treasury & Spend',
    category: 'Accounting & Finance',
    icon: 'credit-card',
    description: 'Corporate treasury accounts, yield reserves, expense budgets, and bill pay rails.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['BREX_API_TOKEN'],
    capabilities: ['read_accounts', 'read_expenses', 'read_transfers'],
    contributedEntities: ['Treasury Balances', 'Corporate Expenses', 'Disbursements'],
    dataFreshnessModel: 'Hourly Polling',
    functionalStatus: getCleanEnv('BREX_API_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'billcom',
    name: 'Bill.com AP/AR Automation',
    category: 'Accounting & Finance',
    icon: 'file-text',
    description: 'Accounts payable approval workflows, ACH vendor payments, and invoice collections.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['BILLCOM_API_KEY', 'BILLCOM_ORG_ID'],
    capabilities: ['read_bills', 'read_vendors', 'read_approvals'],
    contributedEntities: ['Vendor Invoices', 'Payment Approvals', 'Aging Payables'],
    dataFreshnessModel: 'Daily Batch Sync',
    functionalStatus: (getCleanEnv('BILLCOM_API_KEY') && getCleanEnv('BILLCOM_ORG_ID')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'sap',
    name: 'SAP S/4HANA ERP',
    category: 'Accounting & Finance',
    icon: 'database',
    description: 'Enterprise cost centers, supply chain financial flows, and global corporate ledger.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['SAP_SERVICE_URL', 'SAP_API_KEY'],
    capabilities: ['read_cost_centers', 'read_financial_documents', 'read_purchase_requisitions'],
    contributedEntities: ['Cost Centers', 'Financial Vouchers', 'Purchase Requisitions'],
    dataFreshnessModel: 'Scheduled OData Sync',
    functionalStatus: (getCleanEnv('SAP_SERVICE_URL') && getCleanEnv('SAP_API_KEY')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'chargebee',
    name: 'Chargebee Subscription Billing',
    category: 'Accounting & Finance',
    icon: 'credit-card',
    description: 'Multi-plan recurring billing, tax compliance engines, and dunning churn recovery.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['CHARGEBEE_API_KEY', 'CHARGEBEE_SITE'],
    capabilities: ['read_subscriptions', 'read_invoices', 'read_customer_entitlements'],
    contributedEntities: ['SaaS Subscriptions', 'Recurring Invoices', 'Dunning Schedules'],
    dataFreshnessModel: 'Real-time Webhook',
    functionalStatus: (getCleanEnv('CHARGEBEE_API_KEY') && getCleanEnv('CHARGEBEE_SITE')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },

  // =========================================================================
  // 3. PAYMENTS & COMMERCE (3)
  // =========================================================================
  {
    id: 'stripe',
    name: 'Stripe Billing & Payments',
    category: 'Payments & Commerce',
    icon: 'credit-card',
    description: 'Authoritative billing, subscription telemetry, invoice settlement, and real-time cash ledger.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['STRIPE_SECRET_KEY'],
    capabilities: ['read_customers', 'read_subscriptions', 'read_invoices', 'read_balance', 'stage_refund_action'],
    contributedEntities: ['Customers', 'Subscriptions', 'Invoices', 'Treasury Balance'],
    dataFreshnessModel: 'Real-time Webhook + Hourly Polling',
    functionalStatus: getCleanEnv('STRIPE_SECRET_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'shopify',
    name: 'Shopify Merchant Commerce',
    category: 'Payments & Commerce',
    icon: 'credit-card',
    description: 'Direct-to-consumer store orders, merchandise inventory levels, and customer checkouts.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['SHOPIFY_ACCESS_TOKEN', 'SHOPIFY_STORE_DOMAIN'],
    capabilities: ['read_orders', 'read_products', 'read_customers'],
    contributedEntities: ['Store Orders', 'Product Inventory', 'Commerce Customers'],
    dataFreshnessModel: 'Webhook Triggered',
    functionalStatus: (getCleanEnv('SHOPIFY_ACCESS_TOKEN') && getCleanEnv('SHOPIFY_STORE_DOMAIN')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'paypal',
    name: 'PayPal Commerce Platform',
    category: 'Payments & Commerce',
    icon: 'credit-card',
    description: 'Global checkout dispute handling, merchant wallet balances, and international payouts.',
    authMethod: 'oauth2_standard',
    requiredEnvVars: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
    capabilities: ['read_disputes', 'read_transactions', 'read_payouts'],
    contributedEntities: ['Payment Disputes', 'Merchant Balances', 'Global Transfers'],
    dataFreshnessModel: 'Instant IPN & Webhooks',
    functionalStatus: (getCleanEnv('PAYPAL_CLIENT_ID') && getCleanEnv('PAYPAL_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },

  // =========================================================================
  // 4. EMAIL & COMMUNICATION (6)
  // =========================================================================
  {
    id: 'gmail',
    name: 'Google Workspace Gmail',
    category: 'Email & Communication',
    icon: 'mail',
    description: 'Executive communication channels, client thread monitoring, commitments, and dossiers.',
    authMethod: 'oauth2_pkce',
    requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    capabilities: ['read_emails', 'create_email_draft', 'extract_commitments'],
    contributedEntities: ['Email Threads', 'Executive Commitments', 'Client Communications'],
    dataFreshnessModel: 'Push Notifications + Sync Polling',
    functionalStatus: (getCleanEnv('GOOGLE_CLIENT_ID') && getCleanEnv('GOOGLE_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'slack',
    name: 'Slack Enterprise Grid',
    category: 'Email & Communication',
    icon: 'message-square',
    description: 'Internal team coordination, incident war-room channels, and decision dispatch.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'],
    capabilities: ['read_channels', 'post_message', 'listen_mentions'],
    contributedEntities: ['Incident Channels', 'Decision Messages', 'Team Commitments'],
    dataFreshnessModel: 'Socket Mode / Event API',
    functionalStatus: (getCleanEnv('SLACK_BOT_TOKEN') && getCleanEnv('SLACK_SIGNING_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'msteams',
    name: 'Microsoft Teams',
    category: 'Email & Communication',
    icon: 'message-square',
    description: 'Enterprise organization channels, meeting transcripts, and departmental announcements.',
    authMethod: 'oauth2_standard',
    requiredEnvVars: ['MSTEAMS_CLIENT_ID', 'MSTEAMS_CLIENT_SECRET'],
    capabilities: ['read_channels', 'read_chats', 'send_message'],
    contributedEntities: ['Team Channels', 'Executive Meeting Chats', 'Alert Broadcasts'],
    dataFreshnessModel: 'Graph API Subscription',
    functionalStatus: (getCleanEnv('MSTEAMS_CLIENT_ID') && getCleanEnv('MSTEAMS_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook 365',
    category: 'Email & Communication',
    icon: 'mail',
    description: 'Corporate exchange mailbox, executive thread monitoring, and urgent flag detection.',
    authMethod: 'oauth2_standard',
    requiredEnvVars: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'],
    capabilities: ['read_messages', 'read_folders', 'create_draft'],
    contributedEntities: ['Exchange Threads', 'Executive Mail', 'Contract Attachments'],
    dataFreshnessModel: 'Microsoft Graph Webhooks',
    functionalStatus: (getCleanEnv('MICROSOFT_CLIENT_ID') && getCleanEnv('MICROSOFT_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'intercom',
    name: 'Intercom Customer Engagement',
    category: 'Email & Communication',
    icon: 'life-buoy',
    description: 'In-app user conversations, product tour interactions, and VIP client chats.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['INTERCOM_ACCESS_TOKEN'],
    capabilities: ['read_conversations', 'read_users', 'tag_conversation'],
    contributedEntities: ['Client Conversations', 'VIP Inquiries', 'CSAT Ratings'],
    dataFreshnessModel: 'Instant Webhook',
    functionalStatus: getCleanEnv('INTERCOM_ACCESS_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'resend',
    name: 'Resend Transactional Email',
    category: 'Email & Communication',
    icon: 'mail',
    description: 'Governed executive notifications, customer statements, and system alert delivery.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['RESEND_API_KEY'],
    capabilities: ['send_transactional_email'],
    contributedEntities: ['Email Delivery Logs'],
    dataFreshnessModel: 'Immediate Dispatch',
    functionalStatus: getCleanEnv('RESEND_API_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },

  // =========================================================================
  // 5. CALENDARS & SCHEDULING (2)
  // =========================================================================
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    category: 'Calendars & Scheduling',
    icon: 'calendar',
    description: 'Executive scheduling, client meetings, attendee briefs, and preparation dossiers.',
    authMethod: 'oauth2_pkce',
    requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    capabilities: ['read_events', 'schedule_meeting', 'attendee_analysis'],
    contributedEntities: ['Calendar Events', 'Attendee Dossiers', 'Executive Schedules'],
    dataFreshnessModel: 'Real-time Push Sync',
    functionalStatus: (getCleanEnv('GOOGLE_CLIENT_ID') && getCleanEnv('GOOGLE_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'calendly',
    name: 'Calendly Enterprise Scheduling',
    category: 'Calendars & Scheduling',
    icon: 'calendar',
    description: 'Automated sales routing, executive booking links, and prospect conversion timestamps.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['CALENDLY_ACCESS_TOKEN'],
    capabilities: ['read_scheduled_events', 'read_event_types', 'read_invitees'],
    contributedEntities: ['Booked Meetings', 'Sales Route Conversions', 'Invitee Profiles'],
    dataFreshnessModel: 'Webhook Trigger',
    functionalStatus: getCleanEnv('CALENDLY_ACCESS_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },

  // =========================================================================
  // 6. CUSTOMER SUPPORT (5)
  // =========================================================================
  {
    id: 'zendesk',
    name: 'Zendesk Support',
    category: 'Customer Support',
    icon: 'life-buoy',
    description: 'Customer ticket escalations, SLA tracking, churn indicators, and CSAT telemetry.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['ZENDESK_SUBDOMAIN', 'ZENDESK_API_TOKEN'],
    capabilities: ['read_tickets', 'read_satisfaction_ratings', 'escalate_ticket'],
    contributedEntities: ['Support Tickets', 'SLA Incidents', 'Customer CSAT'],
    dataFreshnessModel: 'Real-time Webhook Trigger',
    functionalStatus: (getCleanEnv('ZENDESK_SUBDOMAIN') && getCleanEnv('ZENDESK_API_TOKEN')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'freshdesk',
    name: 'Freshdesk Support',
    category: 'Customer Support',
    icon: 'life-buoy',
    description: 'Multi-channel ticket resolution, first-response SLAs, and agent workload distribution.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['FRESHDESK_DOMAIN', 'FRESHDESK_API_KEY'],
    capabilities: ['read_tickets', 'read_agents', 'update_ticket_status'],
    contributedEntities: ['Helpdesk Tickets', 'First Response SLAs', 'Resolution Times'],
    dataFreshnessModel: 'Hourly Polling + Webhooks',
    functionalStatus: (getCleanEnv('FRESHDESK_DOMAIN') && getCleanEnv('FRESHDESK_API_KEY')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'gainsight',
    name: 'Gainsight Customer Success',
    category: 'Customer Support',
    icon: 'trending-up',
    description: 'Customer health scores, renewal risk assessment, and retention playbooks.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['GAINSIGHT_ACCESS_KEY', 'GAINSIGHT_DOMAIN'],
    capabilities: ['read_health_scores', 'read_renewal_alerts', 'read_scorecards'],
    contributedEntities: ['Customer Health Scores', 'Renewal Risk Flags', 'Account Scorecards'],
    dataFreshnessModel: 'Daily Batch Sync',
    functionalStatus: (getCleanEnv('GAINSIGHT_ACCESS_KEY') && getCleanEnv('GAINSIGHT_DOMAIN')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'churnzero',
    name: 'ChurnZero Customer Success',
    category: 'Customer Support',
    icon: 'activity',
    description: 'Real-time customer usage drops, license adoption tracking, and automated retention plays.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['CHURNZERO_APP_KEY'],
    capabilities: ['read_churn_scores', 'read_account_usage', 'trigger_playbook'],
    contributedEntities: ['Churn Risk Alerts', 'Feature Adoption Drops', 'Retention Plays'],
    dataFreshnessModel: 'Hourly Sync',
    functionalStatus: getCleanEnv('CHURNZERO_APP_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty Incident Response',
    category: 'Customer Support',
    icon: 'alert-triangle',
    description: 'Critical service outages, on-call engineer escalations, and incident MTTR tracking.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['PAGERDUTY_API_TOKEN'],
    capabilities: ['read_incidents', 'read_oncall_schedules', 'read_services'],
    contributedEntities: ['P1 Outages', 'Active Incident Responders', 'MTTR Metrics'],
    dataFreshnessModel: 'Instant Outage Webhooks',
    functionalStatus: getCleanEnv('PAGERDUTY_API_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },

  // =========================================================================
  // 7. PROJECT & ENGINEERING (8)
  // =========================================================================
  {
    id: 'jira',
    name: 'Atlassian Jira Enterprise',
    category: 'Project & Engineering',
    icon: 'check-square',
    description: 'Sprint capacity, engineering bug blockers, release roadmap, and sprint story velocity.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['JIRA_HOST', 'JIRA_API_TOKEN'],
    capabilities: ['read_issues', 'read_sprints', 'create_issue'],
    contributedEntities: ['Sprint Tasks', 'Engineering Bugs', 'Roadmap Epics'],
    dataFreshnessModel: 'Webhook + Polling',
    functionalStatus: (getCleanEnv('JIRA_HOST') && getCleanEnv('JIRA_API_TOKEN')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'github',
    name: 'GitHub Enterprise',
    category: 'Project & Engineering',
    icon: 'code',
    description: 'Pull requests, commit velocity, release deployments, and security vulnerability scans.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['GITHUB_TOKEN'],
    capabilities: ['read_pull_requests', 'read_deployments', 'read_vulnerabilities'],
    contributedEntities: ['Pull Requests', 'Deployments', 'Dependabot Alerts'],
    dataFreshnessModel: 'Webhook Trigger',
    functionalStatus: getCleanEnv('GITHUB_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'linear',
    name: 'Linear Velocity',
    category: 'Project & Engineering',
    icon: 'git-pull-request',
    description: 'Fast-paced product engineering cycles, customer issue tracking, and roadmap delivery.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['LINEAR_API_KEY'],
    capabilities: ['read_issues', 'read_cycles', 'create_issue'],
    contributedEntities: ['Product Issues', 'Engineering Cycles', 'Roadmap Projects'],
    dataFreshnessModel: 'Real-time Webhook',
    functionalStatus: getCleanEnv('LINEAR_API_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'asana',
    name: 'Asana Project Management',
    category: 'Project & Engineering',
    icon: 'check-square',
    description: 'Cross-functional initiatives, executive OKRs, operational checklists, and deliverables.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['ASANA_ACCESS_TOKEN'],
    capabilities: ['read_projects', 'read_tasks', 'update_task'],
    contributedEntities: ['Initiatives', 'Project Tasks', 'Department OKRs'],
    dataFreshnessModel: 'Webhook Trigger',
    functionalStatus: getCleanEnv('ASANA_ACCESS_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'monday',
    name: 'Monday.com Work OS',
    category: 'Project & Engineering',
    icon: 'check-square',
    description: 'Team capacity boards, multi-project workflows, and client deliverable milestones.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['MONDAY_API_TOKEN'],
    capabilities: ['read_boards', 'read_items', 'update_item_status'],
    contributedEntities: ['Operational Boards', 'Tracked Items', 'Milestone Dates'],
    dataFreshnessModel: 'Hourly Polling',
    functionalStatus: getCleanEnv('MONDAY_API_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'clickup',
    name: 'ClickUp Workspace',
    category: 'Project & Engineering',
    icon: 'check-square',
    description: 'Hierarchical task management, sprint timelines, and cross-team goal tracking.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['CLICKUP_API_TOKEN'],
    capabilities: ['read_spaces', 'read_tasks', 'create_task'],
    contributedEntities: ['Workspace Spaces', 'Assigned Deliverables', 'Sprint Goals'],
    dataFreshnessModel: 'Webhook + Polling',
    functionalStatus: getCleanEnv('CLICKUP_API_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'gitlab',
    name: 'GitLab DevOps & CI/CD',
    category: 'Project & Engineering',
    icon: 'code',
    description: 'Merge request reviews, CI/CD pipeline runs, and container registry deployments.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['GITLAB_PRIVATE_TOKEN'],
    capabilities: ['read_projects', 'read_merge_requests', 'read_pipelines'],
    contributedEntities: ['Code Repositories', 'Merge Requests', 'Pipeline Executions'],
    dataFreshnessModel: 'Webhook Trigger',
    functionalStatus: getCleanEnv('GITLAB_PRIVATE_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'figma',
    name: 'Figma Design Workspace',
    category: 'Project & Engineering',
    icon: 'layers',
    description: 'Product design specs, component design systems, and prototype review comments.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['FIGMA_PERSONAL_ACCESS_TOKEN'],
    capabilities: ['read_files', 'read_comments', 'read_components'],
    contributedEntities: ['Design Files', 'Component Systems', 'Spec Comments'],
    dataFreshnessModel: 'On-Demand Querying',
    functionalStatus: getCleanEnv('FIGMA_PERSONAL_ACCESS_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },

  // =========================================================================
  // 8. CONTRACTS & DOCUMENTS (6)
  // =========================================================================
  {
    id: 'docusign',
    name: 'DocuSign E-Signature',
    category: 'Contracts & Documents',
    icon: 'file-check',
    description: 'Executive contract execution, signature status, and audit trails for master agreements.',
    authMethod: 'oauth2_standard',
    requiredEnvVars: ['DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_USER_ID'],
    capabilities: ['read_envelopes', 'read_recipients', 'download_documents'],
    contributedEntities: ['Legal Envelopes', 'Pending Signatures', 'Executed Agreements'],
    dataFreshnessModel: 'Connect Webhook Event',
    functionalStatus: (getCleanEnv('DOCUSIGN_INTEGRATION_KEY') && getCleanEnv('DOCUSIGN_USER_ID')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'pandadoc',
    name: 'PandaDoc Document Automation',
    category: 'Contracts & Documents',
    icon: 'file-check',
    description: 'Sales proposal quotes, statements of work (SOWs), and customer acceptance tracking.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['PANDADOC_API_KEY'],
    capabilities: ['read_documents', 'read_quotes', 'read_approvals'],
    contributedEntities: ['Sales Proposals', 'Client SOWs', 'Quote Confirmations'],
    dataFreshnessModel: 'Webhook Triggered',
    functionalStatus: getCleanEnv('PANDADOC_API_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'ironclad',
    name: 'Ironclad Contract Lifecycle',
    category: 'Contracts & Documents',
    icon: 'file-check',
    description: 'Enterprise contract redlines, clause negotiations, and legal approval gate checks.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['IRONCLAD_API_KEY'],
    capabilities: ['read_workflows', 'read_records', 'read_signers'],
    contributedEntities: ['Contract Workflows', 'Clause Revisions', 'Legal Approvals'],
    dataFreshnessModel: 'Webhook + Hourly Sync',
    functionalStatus: getCleanEnv('IRONCLAD_API_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'notion',
    name: 'Notion Workspace Knowledge',
    category: 'Contracts & Documents',
    icon: 'file-text',
    description: 'Internal operating documentation, company handbooks, and executive decision registers.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['NOTION_API_KEY'],
    capabilities: ['read_databases', 'read_pages', 'search_knowledge'],
    contributedEntities: ['Operating Procedures', 'Company Wikis', 'Decision Logs'],
    dataFreshnessModel: 'Hourly Polling',
    functionalStatus: getCleanEnv('NOTION_API_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'coda',
    name: 'Coda Collaborative Docs',
    category: 'Contracts & Documents',
    icon: 'file-text',
    description: 'Interactive business tools, operating cadences, and internal approval forms.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['CODA_API_TOKEN'],
    capabilities: ['read_docs', 'read_tables', 'read_formulas'],
    contributedEntities: ['Operating Docs', 'Custom Tables', 'Workflow Submissions'],
    dataFreshnessModel: 'Scheduled Polling',
    functionalStatus: getCleanEnv('CODA_API_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'googledrive',
    name: 'Google Drive Workspace',
    category: 'Contracts & Documents',
    icon: 'file-text',
    description: 'Enterprise shared folders, executive spreadsheets, slides, and confidential records.',
    authMethod: 'oauth2_pkce',
    requiredEnvVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    capabilities: ['search_files', 'read_permissions', 'read_revisions'],
    contributedEntities: ['Shared Files', 'Spreadsheet Ledgers', 'Presentation Decks'],
    dataFreshnessModel: 'Push Notifications + Polling',
    functionalStatus: (getCleanEnv('GOOGLE_CLIENT_ID') && getCleanEnv('GOOGLE_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },

  // =========================================================================
  // 9. ANALYTICS & DATA (8)
  // =========================================================================
  {
    id: 'snowflake',
    name: 'Snowflake Data Cloud',
    category: 'Analytics & Data',
    icon: 'database',
    description: 'Authoritative data warehouse, revenue mart queries, and historical business trends.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD'],
    capabilities: ['execute_query', 'read_warehouses', 'read_tables'],
    contributedEntities: ['Warehouse Tables', 'Revenue Mart Records', 'Query Telemetry'],
    dataFreshnessModel: 'On-Demand Direct Querying',
    functionalStatus: (getCleanEnv('SNOWFLAKE_ACCOUNT') && getCleanEnv('SNOWFLAKE_USER')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'bigquery',
    name: 'Google BigQuery Warehouse',
    category: 'Analytics & Data',
    icon: 'database',
    description: 'Serverless enterprise analytics, audit logs, and petabyte-scale business intelligence.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['BIGQUERY_PROJECT_ID'],
    capabilities: ['run_job', 'read_datasets', 'read_table_schemas'],
    contributedEntities: ['Analytical Datasets', 'Revenue Aggregations', 'Audit Telemetry'],
    dataFreshnessModel: 'Scheduled Query Runs',
    functionalStatus: getCleanEnv('BIGQUERY_PROJECT_ID') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'databricks',
    name: 'Databricks Lakehouse',
    category: 'Analytics & Data',
    icon: 'database',
    description: 'Delta Lake transactions, unified corporate metrics, and predictive ML models.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['DATABRICKS_HOST', 'DATABRICKS_TOKEN'],
    capabilities: ['read_clusters', 'read_catalogs', 'execute_sql'],
    contributedEntities: ['Delta Tables', 'Lakehouse Catalogs', 'SQL Endpoints'],
    dataFreshnessModel: 'Direct API Query',
    functionalStatus: (getCleanEnv('DATABRICKS_HOST') && getCleanEnv('DATABRICKS_TOKEN')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'segment',
    name: 'Twilio Segment CDP',
    category: 'Analytics & Data',
    icon: 'activity',
    description: 'Customer data platform, cross-system identity resolution, and user lifecycle events.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['SEGMENT_WRITE_KEY'],
    capabilities: ['track_event', 'identify_user', 'read_sources'],
    contributedEntities: ['User Identities', 'Event Funnels', 'Source Connectors'],
    dataFreshnessModel: 'Real-time Event Stream',
    functionalStatus: getCleanEnv('SEGMENT_WRITE_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'posthog',
    name: 'PostHog Product Analytics',
    category: 'Analytics & Data',
    icon: 'activity',
    description: 'Feature flags, product adoption funnels, session analytics, and user retention.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['POSTHOG_API_KEY', 'POSTHOG_HOST'],
    capabilities: ['read_feature_flags', 'read_insights', 'read_events'],
    contributedEntities: ['Feature Flags', 'User Funnels', 'Retention Trends'],
    dataFreshnessModel: 'Hourly Polling',
    functionalStatus: (getCleanEnv('POSTHOG_API_KEY') && getCleanEnv('POSTHOG_HOST')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel Product Analytics',
    category: 'Analytics & Data',
    icon: 'activity',
    description: 'User conversion cohorts, multi-touch product paths, and active monthly user metrics.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['MIXPANEL_PROJECT_TOKEN'],
    capabilities: ['query_cohorts', 'query_insights', 'query_retention'],
    contributedEntities: ['Active Cohorts', 'Conversion Funnels', 'MAU Metrics'],
    dataFreshnessModel: 'Daily Batch Sync',
    functionalStatus: getCleanEnv('MIXPANEL_PROJECT_TOKEN') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'datadog',
    name: 'Datadog Cloud Observability',
    category: 'Analytics & Data',
    icon: 'activity',
    description: 'Cloud infrastructure metrics, APM service latencies, and critical error monitors.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['DATADOG_API_KEY', 'DATADOG_APP_KEY'],
    capabilities: ['read_monitors', 'read_service_slos', 'query_metrics'],
    contributedEntities: ['Infrastructure Monitors', 'Service Latencies', 'Error Budgets'],
    dataFreshnessModel: 'Real-time Metric Stream',
    functionalStatus: (getCleanEnv('DATADOG_API_KEY') && getCleanEnv('DATADOG_APP_KEY')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'sentry',
    name: 'Sentry Error & APM Tracking',
    category: 'Analytics & Data',
    icon: 'alert-triangle',
    description: 'Production exception crashes, affected customer counts, and release regressions.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG'],
    capabilities: ['read_issues', 'read_releases', 'read_project_stats'],
    contributedEntities: ['Production Crashes', 'Affected Customers', 'Release Regressions'],
    dataFreshnessModel: 'Instant Issue Webhook',
    functionalStatus: (getCleanEnv('SENTRY_AUTH_TOKEN') && getCleanEnv('SENTRY_ORG')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },

  // =========================================================================
  // 10. HR & OPERATIONS (6)
  // =========================================================================
  {
    id: 'workday',
    name: 'Workday HCM & Financials',
    category: 'HR & Operations',
    icon: 'users',
    description: 'Enterprise employee roster, headcount cost planning, compensation, and org hierarchy.',
    authMethod: 'oauth2_standard',
    requiredEnvVars: ['WORKDAY_CLIENT_ID', 'WORKDAY_CLIENT_SECRET', 'WORKDAY_TENANT'],
    capabilities: ['read_workers', 'read_organizations', 'read_compensation'],
    contributedEntities: ['Employee Roster', 'Headcount Budgets', 'Department Trees'],
    dataFreshnessModel: 'Daily HR Batch',
    functionalStatus: (getCleanEnv('WORKDAY_CLIENT_ID') && getCleanEnv('WORKDAY_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'rippling',
    name: 'Rippling Workforce Platform',
    category: 'HR & Operations',
    icon: 'users',
    description: 'Global payroll execution, device management, and automated employee onboarding.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['RIPPLING_API_KEY'],
    capabilities: ['read_employees', 'read_teams', 'read_payroll_runs'],
    contributedEntities: ['Active Staff', 'Payroll Runs', 'App Access Matrix'],
    dataFreshnessModel: 'Hourly Polling',
    functionalStatus: getCleanEnv('RIPPLING_API_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'deel',
    name: 'Deel Global Payroll & Contractors',
    category: 'HR & Operations',
    icon: 'users',
    description: 'International contractor contracts, compliance filings, and foreign currency payouts.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['DEEL_API_KEY'],
    capabilities: ['read_contracts', 'read_invoices', 'read_compliance_docs'],
    contributedEntities: ['Contractor Agreements', 'Global Invoices', 'Tax Forms'],
    dataFreshnessModel: 'Daily Batch Sync',
    functionalStatus: getCleanEnv('DEEL_API_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'gusto',
    name: 'Gusto Modern Payroll',
    category: 'HR & Operations',
    icon: 'users',
    description: 'Domestic payroll runs, direct deposits, health benefits, and tax filings.',
    authMethod: 'oauth2_standard',
    requiredEnvVars: ['GUSTO_CLIENT_ID', 'GUSTO_CLIENT_SECRET'],
    capabilities: ['read_payrolls', 'read_employees', 'read_benefits'],
    contributedEntities: ['Payroll Summaries', 'Direct Deposits', 'Tax Filings'],
    dataFreshnessModel: 'Pay-Period Webhook',
    functionalStatus: (getCleanEnv('GUSTO_CLIENT_ID') && getCleanEnv('GUSTO_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'bamboohr',
    name: 'BambooHR People Operations',
    category: 'HR & Operations',
    icon: 'users',
    description: 'Company staff directory, paid time off (PTO) requests, and hiring applicant tracking.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['BAMBOOHR_API_KEY', 'BAMBOOHR_SUBDOMAIN'],
    capabilities: ['read_directory', 'read_time_off', 'read_job_openings'],
    contributedEntities: ['Staff Directory', 'PTO Requests', 'Job Openings'],
    dataFreshnessModel: 'Hourly Sync',
    functionalStatus: (getCleanEnv('BAMBOOHR_API_KEY') && getCleanEnv('BAMBOOHR_SUBDOMAIN')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'aws',
    name: 'AWS CloudWatch & FinOps',
    category: 'Analytics & Data',
    icon: 'database',
    description: 'Enterprise cloud infrastructure spending, compute cost forecasts, and utilization alarms.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'],
    capabilities: ['read_cost_forecast', 'read_alarms', 'read_ec2_instances'],
    contributedEntities: ['Monthly AWS Spend', 'Cost Forecasts', 'CloudWatch Alarms'],
    dataFreshnessModel: 'Daily FinOps Sync',
    functionalStatus: (getCleanEnv('AWS_ACCESS_KEY_ID') && getCleanEnv('AWS_SECRET_ACCESS_KEY')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },

  // =========================================================================
  // 11. SECURITY & COMPLIANCE (3)
  // =========================================================================
  {
    id: 'vanta',
    name: 'Vanta Continuous Compliance',
    category: 'Security & Compliance',
    icon: 'shield-check',
    description: 'Automated SOC 2 / ISO 27001 controls, security test monitoring, and vendor risk scores.',
    authMethod: 'oauth2_standard',
    requiredEnvVars: ['VANTA_CLIENT_ID', 'VANTA_CLIENT_SECRET'],
    capabilities: ['read_controls', 'read_tests', 'read_vendors'],
    contributedEntities: ['SOC 2 Controls', 'Failing Security Tests', 'Vendor Risk Scores'],
    dataFreshnessModel: 'Continuous Real-time Evaluation',
    functionalStatus: (getCleanEnv('VANTA_CLIENT_ID') && getCleanEnv('VANTA_CLIENT_SECRET')) ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'drata',
    name: 'Drata Compliance Automation',
    category: 'Security & Compliance',
    icon: 'shield-check',
    description: 'Audit readiness monitoring, automated evidence collection, and security personnel training.',
    authMethod: 'bearer_token',
    requiredEnvVars: ['DRATA_API_KEY'],
    capabilities: ['read_compliance_status', 'read_evidence', 'read_personnel'],
    contributedEntities: ['Compliance Scores', 'Collected Evidence', 'Trained Personnel'],
    dataFreshnessModel: 'Daily Audit Check',
    functionalStatus: getCleanEnv('DRATA_API_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  },
  {
    id: 'google_maps',
    name: 'Google Maps Platform',
    category: 'Analytics & Data',
    icon: 'activity',
    description: 'Spatial fleet intelligence, geocoding validation, route logistics, and customer location verification.',
    authMethod: 'api_key_secret',
    requiredEnvVars: ['GOOGLE_MAPS_API_KEY'],
    capabilities: ['geocode_address', 'compute_routes', 'spatial_fleet_telemetry'],
    contributedEntities: ['Customer Locations', 'Fleet Coordinates', 'Delivery Routes'],
    dataFreshnessModel: 'On-Demand Querying',
    functionalStatus: getCleanEnv('GOOGLE_MAPS_API_KEY') ? 'REAL_FUNCTIONAL' : 'CREDENTIALS_REQUIRED'
  }
];

export const CONNECTOR_CATALOG_COUNT = CONNECTOR_CATALOG_57.length;
