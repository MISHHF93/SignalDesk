export interface FriendlyToolMeta {
  friendlyCategory: string;
  tagline: string;
  whatItProtects: string[];
  setupTime: string;
  idealFor: string;
  securityNote: string;
}

export const FRIENDLY_TOOL_META_57: Record<string, FriendlyToolMeta> = {
  // CRM & REVENUE
  salesforce: {
    friendlyCategory: 'Sales & Revenue',
    tagline: 'Watches enterprise deals, contract renewals, and executive accounts.',
    whatItProtects: [
      'Alerts you to stalled multi-thousand dollar deals with no activity for 7+ days',
      'Tracks contract expiration and upcoming renewal deadlines',
      'Maps executive sponsors and primary decision-maker relationships'
    ],
    setupTime: '30 seconds',
    idealFor: 'Sales Directors, Account Executives & Founders',
    securityNote: 'Read-only access to pipeline and contact records'
  },
  hubspot: {
    friendlyCategory: 'Sales & Marketing',
    tagline: 'Monitors deal pipeline health, inbound leads, and client communication.',
    whatItProtects: [
      'Catches stalled sales opportunities before the end of the quarter',
      'Tracks response times to high-value inbound customer inquiries',
      'Keeps contact history organized across sales and customer success'
    ],
    setupTime: '30 seconds',
    idealFor: 'Revenue leaders & Growth teams',
    securityNote: 'Read-only pipeline monitoring with Safe Action approvals'
  },
  gong: {
    friendlyCategory: 'Sales & Revenue',
    tagline: 'Analyzes executive sales conversations, client objections, and competitor mentions.',
    whatItProtects: [
      'Flags buyer hesitation and competitor pricing mentions in deal calls',
      'Identifies top objection patterns across your sales team',
      'Alerts executives when strategic accounts raise contract redlines'
    ],
    setupTime: '45 seconds',
    idealFor: 'CROs, VPs of Sales & Sales Enablement',
    securityNote: 'Privacy-compliant transcript metadata processing'
  },
  outreach: {
    friendlyCategory: 'Sales & Revenue',
    tagline: 'Orchestrates sales engagement cadences and prospect response rates.',
    whatItProtects: [
      'Prevents oversaturating high-value executive prospects with duplicate outreach',
      'Monitors sequence conversion efficiency and meeting booking velocity',
      'Syncs active prospect engagement status back to core accounts'
    ],
    setupTime: '30 seconds',
    idealFor: 'Sales Development & Revenue Operations',
    securityNote: 'Read-only sequence and touchpoint observation'
  },
  salesloft: {
    friendlyCategory: 'Sales & Revenue',
    tagline: 'Tracks revenue cadences, deal forecasts, and buyer interaction history.',
    whatItProtects: [
      'Surfaces active buyer engagements before critical pipeline reviews',
      'Highlights sequence drop-off points for executive sales campaigns',
      'Links sales rep activity directly to quarterly closed-won revenue'
    ],
    setupTime: '30 seconds',
    idealFor: 'Revenue Operations & Inside Sales Teams',
    securityNote: 'Token-vaulted read access with governance boundaries'
  },
  apollo: {
    friendlyCategory: 'Sales & Revenue',
    tagline: 'Enriches prospective accounts with verified contacts and hiring intent signals.',
    whatItProtects: [
      'Validates corporate email deliverability to avoid domain blacklisting',
      'Detects executive hiring surges and technology adoption changes',
      'Enriches CRM accounts with verified employee counts and revenue bands'
    ],
    setupTime: '20 seconds',
    idealFor: 'Demand Gen & Outbound Sales Teams',
    securityNote: 'Read-only contact enrichment querying'
  },
  zoominfo: {
    friendlyCategory: 'Sales & Revenue',
    tagline: 'Enterprise firmographic hierarchies, executive decision-makers, and intent spikes.',
    whatItProtects: [
      'Alerts your team when target enterprise accounts show sudden intent spikes',
      'Maps complex corporate parent-subsidiary organizational trees',
      'Verifies executive job changes among your key client champions'
    ],
    setupTime: '45 seconds',
    idealFor: 'Enterprise Account Executives & Strategy Teams',
    securityNote: 'Secure API token query with tenant isolation'
  },
  pipedrive: {
    friendlyCategory: 'Sales & Revenue',
    tagline: 'Tracks deal pipeline progression, scheduled activities, and win rates.',
    whatItProtects: [
      'Identifies neglected deals without scheduled next steps',
      'Monitors team activity targets and sales velocity',
      'Provides clear visual deal status across custom sales stages'
    ],
    setupTime: '20 seconds',
    idealFor: 'SMB Sales Teams & Founders',
    securityNote: 'Read-only pipeline tracking'
  },

  // ACCOUNTING & FINANCE
  quickbooks: {
    friendlyCategory: 'Billing & Accounting',
    tagline: 'Watches overdue customer invoices, vendor bills, and real-time cashflow.',
    whatItProtects: [
      'Flags invoices past 30, 45, or 60 days overdue automatically',
      'Calculates true cashflow runway without opening messy spreadsheets',
      'Identifies unbilled client hours and pending vendor payables'
    ],
    setupTime: '45 seconds',
    idealFor: 'CEOs, CFOs, Controllers & Operations',
    securityNote: 'Read-only bank-grade ledger observation'
  },
  xero: {
    friendlyCategory: 'Billing & Accounting',
    tagline: 'Global multi-currency ledger, bank reconciliations, and overdue bills.',
    whatItProtects: [
      'Reconciles international bank feeds and detects foreign exchange variance',
      'Flags unpaid client invoices and pending contractor payments',
      'Maintains accurate balance sheet figures for executive dashboards'
    ],
    setupTime: '30 seconds',
    idealFor: 'International Businesses & Financial Controllers',
    securityNote: 'OAuth 2.0 encrypted read-only financial sync'
  },
  netsuite: {
    friendlyCategory: 'Billing & Accounting',
    tagline: 'Enterprise ERP ledger, multi-entity subsidiary consolidation, and purchase orders.',
    whatItProtects: [
      'Correlates cross-subsidiary intercompany balances and eliminations',
      'Monitors large purchase order authorizations against departmental budgets',
      'Maintains real-time general ledger truth across global entities'
    ],
    setupTime: '60 seconds',
    idealFor: 'Enterprise CFOs, VPs of Finance & ERP Admins',
    securityNote: 'Token-based authentication with strict role separation'
  },
  mercury: {
    friendlyCategory: 'Banking & Cashflow',
    tagline: 'Watches real operating cash balances, treasury yield, and outgoing wires.',
    whatItProtects: [
      'Warns executives when cash reserves drop below 90 days of operational runway',
      'Verifies incoming high-value wire transfers and customer ACH settlements',
      'Monitors outgoing vendor wire disbursements for dual-authorization compliance'
    ],
    setupTime: '20 seconds',
    idealFor: 'Founders, CFOs & Treasury Managers',
    securityNote: 'Read-only token with zero fund transfer authority'
  },
  ramp: {
    friendlyCategory: 'Spend Management',
    tagline: 'Monitors corporate card spend, expense outliers, and recurring SaaS subscriptions.',
    whatItProtects: [
      'Detects sudden price increases or duplicate SaaS card subscriptions',
      'Flags employees nearing card spending limits before transactions decline',
      'Enforces company expense policies with automated receipt audit trails'
    ],
    setupTime: '30 seconds',
    idealFor: 'Finance Directors & Operations Leads',
    securityNote: 'OAuth 2.0 read-only transaction feeds'
  },
  brex: {
    friendlyCategory: 'Spend Management',
    tagline: 'Observes corporate credit limits, rewards yield, and operational card burn.',
    whatItProtects: [
      'Tracks company monthly credit card burn rate against operating cash',
      'Flags high-dollar unapproved expense submissions in real time',
      'Monitors corporate treasury yields and sweep account balances'
    ],
    setupTime: '25 seconds',
    idealFor: 'Founders, Controllers & Accounting Teams',
    securityNote: 'Read-only API access to transaction summaries'
  },
  billcom: {
    friendlyCategory: 'Billing & Accounting',
    tagline: 'Accounts payable automation, vendor approval queues, and disbursement schedules.',
    whatItProtects: [
      'Prevents late payment penalties by flagging bills awaiting executive approval',
      'Verifies vendor bank details against unauthorized modification attempts',
      'Streamlines accounts receivable payment collections'
    ],
    setupTime: '40 seconds',
    idealFor: 'Accounts Payable Teams & Financial Controllers',
    securityNote: 'API key authentication with zero disbursement execution'
  },
  sap: {
    friendlyCategory: 'Enterprise ERP',
    tagline: 'S/4HANA financial vouchers, cost centers, and procurement reconciliation.',
    whatItProtects: [
      'Monitors global cost center expenditures against annual operating plans',
      'Reconciles complex supply chain orders with vendor invoice line items',
      'Surfaces audit-grade financial data for enterprise compliance'
    ],
    setupTime: '60 seconds',
    idealFor: 'Enterprise Operations & Global Controllers',
    securityNote: 'Secure OData service connection with encryption'
  },
  chargebee: {
    friendlyCategory: 'Billing & Subscriptions',
    tagline: 'Multi-plan recurring billing, customer dunning recovery, and deferred revenue.',
    whatItProtects: [
      'Tracks failed credit card rebills and triggers automated dunning cadences',
      'Calculates accurate deferred revenue waterfalls for ASC 606 compliance',
      'Monitors tier upgrade and downgrade velocity across active subscribers'
    ],
    setupTime: '30 seconds',
    idealFor: 'SaaS Finance & Growth Operations',
    securityNote: 'Read-only restricted API key configuration'
  },

  // PAYMENTS & COMMERCE
  stripe: {
    friendlyCategory: 'Payments & Revenue',
    tagline: 'Monitors recurring subscriptions, failed card charges, and customer churn.',
    whatItProtects: [
      'Instantly alerts on failed high-value recurring card charges',
      'Tracks monthly recurring revenue (MRR) changes and customer refunds',
      'Identifies accounts at risk of cancellation due to billing errors'
    ],
    setupTime: '30 seconds',
    idealFor: 'SaaS companies, E-commerce & Subscription businesses',
    securityNote: 'Restricted read-only access to transaction summaries'
  },
  shopify: {
    friendlyCategory: 'E-Commerce',
    tagline: 'Online store orders, customer checkout volumes, and fulfillment bottlenecks.',
    whatItProtects: [
      'Monitors unfulfilled high-value orders and delayed shipping timelines',
      'Tracks abandoned checkout spikes that signal payment gateway degradation',
      'Correlates inventory stockouts with prospective customer demand'
    ],
    setupTime: '30 seconds',
    idealFor: 'DTC Brands, E-Commerce Directors & Merchants',
    securityNote: 'Read-only access to orders and inventory'
  },
  paypal: {
    friendlyCategory: 'Payments & Commerce',
    tagline: 'Merchant wallet reserves, dispute chargeback defense, and foreign currency payouts.',
    whatItProtects: [
      'Alerts your team immediately when a customer files a payment dispute',
      'Monitors available merchant balance reserves held for risk protection',
      'Reconciles multi-currency payments against domestic ledger accounts'
    ],
    setupTime: '30 seconds',
    idealFor: 'Global E-Commerce & Marketplace Operators',
    securityNote: 'OAuth 2.0 transaction read access'
  },

  // EMAIL & COMMUNICATION
  gmail: {
    friendlyCategory: 'Email & Calendar',
    tagline: 'Discovers commitments buried in email threads and prepares executive meeting dossiers.',
    whatItProtects: [
      'Surfaces unfulfilled promises you or your team made to clients',
      'Prepares a 1-page intelligence brief before your key client meetings',
      'Warns if an important client email has sat unanswered for 48+ hours'
    ],
    setupTime: '20 seconds',
    idealFor: 'Founders, Executives & Project Managers',
    securityNote: 'Zero message storage; processed in secure memory'
  },
  slack: {
    friendlyCategory: 'Team Communication',
    tagline: 'Turns team chat requests into tracked deliverables and catches urgent client pings.',
    whatItProtects: [
      'Catches commitments made in public team channels so nothing is forgotten',
      'Surfaces urgent client mentions and escalating internal blockers',
      'Ensures cross-department handoffs have a clear owner and deadline'
    ],
    setupTime: '20 seconds',
    idealFor: 'All teams using Slack',
    securityNote: 'Only monitors authorized channels; read-only'
  },
  msteams: {
    friendlyCategory: 'Team Communication',
    tagline: 'Enterprise organization channels, meeting transcripts, and departmental announcements.',
    whatItProtects: [
      'Monitors strategic executive channels for urgent escalation flags',
      'Surfaces key action items discussed during executive video conferences',
      'Coordinates cross-department announcements and crisis communication'
    ],
    setupTime: '35 seconds',
    idealFor: 'Microsoft 365 Enterprises & Operations Leads',
    securityNote: 'Microsoft Graph read-only tenant application permissions'
  },
  outlook: {
    friendlyCategory: 'Email & Communication',
    tagline: 'Corporate Exchange mailbox, executive thread monitoring, and urgent flag detection.',
    whatItProtects: [
      'Flags unread contractual agreements and audit inquiries from external partners',
      'Prepares executive attendee briefs before board and governance meetings',
      'Detects unresolved commitments across Microsoft 365 email chains'
    ],
    setupTime: '25 seconds',
    idealFor: 'Corporate Executives, Legal & Finance',
    securityNote: 'Encrypted OAuth token with strictly scoped mailbox read access'
  },
  intercom: {
    friendlyCategory: 'Customer Messaging',
    tagline: 'In-app user conversations, product tour feedback, and VIP client chats.',
    whatItProtects: [
      'Alerts executives when an enterprise tier customer reaches out with an issue',
      'Tracks in-app user frustration signals and rapid churn indicators',
      'Ensures customer inquiries receive responses within defined SLA windows'
    ],
    setupTime: '20 seconds',
    idealFor: 'Customer Success Managers & Product Leads',
    securityNote: 'Bearer token with restricted conversation read access'
  },
  resend: {
    friendlyCategory: 'Email Infrastructure',
    tagline: 'Transactional email deliverability, customer statements, and system alert logs.',
    whatItProtects: [
      'Monitors bounce rates and delivery drops on critical client invoice emails',
      'Ensures executive notification emails reach their targets without delay',
      'Verifies cryptographic DKIM/SPF domain verification health'
    ],
    setupTime: '15 seconds',
    idealFor: 'Technical Leads & Operations Engineers',
    securityNote: 'Restricted sending API key'
  },

  // CALENDARS & SCHEDULING
  google_calendar: {
    friendlyCategory: 'Calendars & Scheduling',
    tagline: 'Prepares executive meeting dossiers and alerts you to upcoming client deadlines.',
    whatItProtects: [
      'Generates automated briefing dossiers 1 hour before every external client call',
      'Cross-references meeting attendees against CRM opportunities and past support tickets',
      'Prevents double-booking conflicts across critical company presentations'
    ],
    setupTime: '20 seconds',
    idealFor: 'Founders, Sales Leaders & Account Managers',
    securityNote: 'Read-only calendar event metadata access'
  },
  calendly: {
    friendlyCategory: 'Calendars & Scheduling',
    tagline: 'Sales meeting routing, prospect conversion timestamps, and booking volume.',
    whatItProtects: [
      'Tracks inbound prospect meeting booking rates after marketing campaigns',
      'Monitors cancellation and rescheduling rates for discovery calls',
      'Connects booked meetings directly to CRM sales lead records'
    ],
    setupTime: '20 seconds',
    idealFor: 'Growth Teams & Inbound Sales Representatives',
    securityNote: 'Read-only scheduled event webhook integration'
  },

  // CUSTOMER SUPPORT
  zendesk: {
    friendlyCategory: 'Customer Support',
    tagline: 'Flags frustrated customers and escalates tickets from top accounts.',
    whatItProtects: [
      'Alerts leadership whenever a top-tier client files a support ticket',
      'Detects customer sentiment decline before they decide to cancel',
      'Tracks ticket resolution speed against service level agreements (SLAs)'
    ],
    setupTime: '30 seconds',
    idealFor: 'Customer Success Managers & Support Leads',
    securityNote: 'Read-only ticket observation with governed escalation drafts'
  },
  freshdesk: {
    friendlyCategory: 'Customer Support',
    tagline: 'Multi-channel ticket resolution, first-response SLAs, and agent workloads.',
    whatItProtects: [
      'Flags tickets breaching response time commitments before customers complain',
      'Balances ticket distribution across customer service team members',
      'Surfaces recurring product defect complaints directly to engineering'
    ],
    setupTime: '25 seconds',
    idealFor: 'Helpdesk Managers & Operations Teams',
    securityNote: 'API token access to ticket metadata'
  },
  gainsight: {
    friendlyCategory: 'Customer Success',
    tagline: 'Customer health scores, renewal risk assessment, and retention playbooks.',
    whatItProtects: [
      'Surfaces accounts trending toward red health status 90 days before renewal',
      'Correlates product usage decline with executive leadership turnover',
      'Triggers automated intervention playbooks for at-risk accounts'
    ],
    setupTime: '45 seconds',
    idealFor: 'Chief Customer Officers & Customer Success Leads',
    securityNote: 'Read-only customer health score queries'
  },
  churnzero: {
    friendlyCategory: 'Customer Success',
    tagline: 'Real-time customer usage drops, license adoption tracking, and retention plays.',
    whatItProtects: [
      'Detects sudden drop-offs in active daily user seats across corporate accounts',
      'Flags under-utilized software licenses that indicate downsizing risk',
      'Monitors Net Promoter Score (NPS) surveys and negative client feedback'
    ],
    setupTime: '30 seconds',
    idealFor: 'Customer Success Teams & Retention Specialists',
    securityNote: 'Read-only customer telemetry ingestion'
  },
  pagerduty: {
    friendlyCategory: 'Incident Management',
    tagline: 'Critical service outages, on-call engineer escalations, and incident MTTR.',
    whatItProtects: [
      'Correlates infrastructure outages directly with customer support ticket volume',
      'Tracks Mean Time to Resolution (MTTR) for executive reliability reporting',
      'Alerts leadership immediately when P1 customer-facing incidents are triggered'
    ],
    setupTime: '20 seconds',
    idealFor: 'Site Reliability Engineers, CTOs & Incident Commanders',
    securityNote: 'Read-only incident status and on-call schedule feeds'
  },

  // PROJECT & ENGINEERING
  jira: {
    friendlyCategory: 'Engineering & Projects',
    tagline: 'Tracks sprint deliverables, enterprise tickets, and cross-team dependencies.',
    whatItProtects: [
      'Connects client contractual delivery dates to Jira epic status',
      'Flags stalled tickets that are blocking customer go-lives',
      'Surfaces scope creep and delayed release milestones early'
    ],
    setupTime: '45 seconds',
    idealFor: 'Enterprise IT, PMOs & Engineering Managers',
    securityNote: 'Read-only ticket tracking with safe comment drafting'
  },
  github: {
    friendlyCategory: 'Engineering & Code',
    tagline: 'Verifies software releases, bug fixes, and critical customer issues in code.',
    whatItProtects: [
      'Confirms when customer-promised bug fixes are actually deployed',
      'Tracks status of blocking engineering pull requests and releases',
      'Surfaces critical repository security alerts and pipeline failures'
    ],
    setupTime: '30 seconds',
    idealFor: 'Engineering Leads, CTOs & Technical PMs',
    securityNote: 'Read-only metadata access to issues, PRs, and commit logs'
  },
  linear: {
    friendlyCategory: 'Product & Tasks',
    tagline: 'Links customer commitments directly to active engineering sprints.',
    whatItProtects: [
      'Keeps executive customer promises aligned with sprint delivery dates',
      'Highlights blockers delaying customer-requested product features',
      'Provides automated progress reports without interrupting developers'
    ],
    setupTime: '30 seconds',
    idealFor: 'Product Managers & Software Teams',
    securityNote: 'Read-only issue sync with optional task status updates'
  },
  asana: {
    friendlyCategory: 'Project Management',
    tagline: 'Monitors cross-department projects, task deadlines, and team workloads.',
    whatItProtects: [
      'Tracks multi-department project milestones and delivery deadlines',
      'Identifies overdue action items before they cascade into project delays',
      'Maintains clear ownership across teams without endless status meetings'
    ],
    setupTime: '30 seconds',
    idealFor: 'Project Managers & Operations Leads',
    securityNote: 'Read-only task and project milestone monitoring'
  },
  monday: {
    friendlyCategory: 'Work Management',
    tagline: 'Team capacity boards, multi-project workflows, and client deliverable milestones.',
    whatItProtects: [
      'Monitors client onboarding project timelines and delayed task dependencies',
      'Visualizes team bandwidth to prevent operational burnout',
      'Maintains an executive overview of all departmental deliverables'
    ],
    setupTime: '30 seconds',
    idealFor: 'Operations Directors & Agency Leaders',
    securityNote: 'API token access to board and item structures'
  },
  clickup: {
    friendlyCategory: 'Productivity & Tasks',
    tagline: 'Hierarchical task management, sprint timelines, and cross-team goal tracking.',
    whatItProtects: [
      'Flags high-priority tasks sitting in review stages for excessive durations',
      'Connects company quarterly goals directly to daily team deliverables',
      'Provides unified visibility across multiple company workspaces'
    ],
    setupTime: '25 seconds',
    idealFor: 'Cross-functional Teams & Product Operations',
    securityNote: 'Read-only task and workspace space ingestion'
  },
  gitlab: {
    friendlyCategory: 'DevOps & Code',
    tagline: 'Merge request reviews, CI/CD pipeline runs, and container deployments.',
    whatItProtects: [
      'Detects broken CI/CD deployment pipelines before customer releases',
      'Monitors open merge requests awaiting critical security reviews',
      'Correlates code deployments directly with system error rate changes'
    ],
    setupTime: '30 seconds',
    idealFor: 'DevOps Engineers, Infrastructure Leads & CTOs',
    securityNote: 'Personal access token with read_api permissions'
  },
  figma: {
    friendlyCategory: 'Design & Product',
    tagline: 'Product design specs, component design systems, and prototype review comments.',
    whatItProtects: [
      'Flags unanswered stakeholder comments on client design deliverables',
      'Tracks version releases and design system component updates',
      'Aligns engineering sprint tasks with approved UI/UX mockups'
    ],
    setupTime: '20 seconds',
    idealFor: 'Product Designers, UX Directors & Frontend Leads',
    securityNote: 'Personal access token with read-only file metadata access'
  },

  // CONTRACTS & DOCUMENTS
  docusign: {
    friendlyCategory: 'Contracts & Signatures',
    tagline: 'Executive contract execution, signature status, and audit trails for master agreements.',
    whatItProtects: [
      'Alerts leadership when key multi-year agreements sit unsigned by clients',
      'Tracks complete legal audit trails and signature timestamps',
      'Notifies account executives the moment an enterprise contract is executed'
    ],
    setupTime: '35 seconds',
    idealFor: 'General Counsel, Sales Leadership & Operations',
    securityNote: 'OAuth 2.0 encrypted read access to envelope status'
  },
  pandadoc: {
    friendlyCategory: 'Contracts & Signatures',
    tagline: 'Watches contract proposals and flags agreements waiting for client signature.',
    whatItProtects: [
      'Alerts you when a key customer contract sits unviewed or unsigned for 5+ days',
      'Notifies you the moment a client opens a proposal so you can follow up',
      'Maintains an audit trail of signed customer agreements and addendums'
    ],
    setupTime: '30 seconds',
    idealFor: 'Sales Executives, Legal & Operations',
    securityNote: 'Encrypted document status tracking'
  },
  ironclad: {
    friendlyCategory: 'Contract Lifecycle',
    tagline: 'Enterprise contract redlines, clause negotiations, and legal approval gates.',
    whatItProtects: [
      'Flags non-standard indemnity or liability clauses introduced by counterparties',
      'Tracks contract turnaround time across legal and finance reviewers',
      'Ensures all executive approvals are secured before agreements are signed'
    ],
    setupTime: '40 seconds',
    idealFor: 'Legal Operations, In-House Counsel & Deal Desk',
    securityNote: 'API key authentication with strict tenant boundaries'
  },
  notion: {
    friendlyCategory: 'Docs & Knowledge',
    tagline: 'References standard operating procedures, team wikis, and company goals.',
    whatItProtects: [
      'Powers instant answers to team questions using your company handbook',
      'Keeps company quarterly goals (OKRs) and roadmaps connected to daily work',
      'Maintains a single source of truth for company policies and onboarding'
    ],
    setupTime: '30 seconds',
    idealFor: 'Operations, HR & Cross-functional Teams',
    securityNote: 'Read-only access to selected public workspace pages'
  },
  coda: {
    friendlyCategory: 'Docs & Workflows',
    tagline: 'Interactive business tools, operating cadences, and internal approval forms.',
    whatItProtects: [
      'Connects custom internal operational tables directly to business dashboards',
      'Tracks submitted executive approval requests across custom doc packs',
      'Maintains living documentation for company board meetings and rituals'
    ],
    setupTime: '25 seconds',
    idealFor: 'Chiefs of Staff, Program Managers & Operations',
    securityNote: 'Scoped API token with read-only document access'
  },
  googledrive: {
    friendlyCategory: 'Cloud Storage & Docs',
    tagline: 'Enterprise shared folders, executive spreadsheets, and confidential records.',
    whatItProtects: [
      'Indexes corporate financial models and board slide decks securely',
      'Alerts admins to files shared publicly or outside the corporate domain',
      'Provides universal retrieval across all corporate drive folders'
    ],
    setupTime: '30 seconds',
    idealFor: 'Executives, Legal & All Knowledge Workers',
    securityNote: 'Google Workspace OAuth with read-only file metadata indexing'
  },

  // ANALYTICS & DATA
  snowflake: {
    friendlyCategory: 'Data Warehouse',
    tagline: 'Authoritative enterprise data cloud, revenue marts, and historical queries.',
    whatItProtects: [
      'Monitors warehouse compute credit consumption against departmental budgets',
      'Validates financial reporting tables against authoritative general ledger sources',
      'Provides high-performance analytical retrieval across customer cohorts'
    ],
    setupTime: '45 seconds',
    idealFor: 'Data Engineers, Heads of BI & CFOs',
    securityNote: 'Restricted role credentials with read-only schema queries'
  },
  bigquery: {
    friendlyCategory: 'Data Warehouse',
    tagline: 'Serverless enterprise analytics, audit logs, and petabyte-scale queries.',
    whatItProtects: [
      'Monitors query processing costs and prevents runaway analytical expenses',
      'Correlates audit log events with customer security reviews',
      'Maintains real-time aggregated metrics for executive summaries'
    ],
    setupTime: '35 seconds',
    idealFor: 'Analytics Engineers, Data Leads & Infrastructure Admins',
    securityNote: 'Google Cloud service account with Viewer permissions'
  },
  databricks: {
    friendlyCategory: 'Lakehouse & AI',
    tagline: 'Delta Lake transactions, unified corporate metrics, and predictive ML models.',
    whatItProtects: [
      'Tracks cluster uptime and automatic scale-down to prevent idle cloud waste',
      'Validates Delta Lake ACID table states and ingestion pipeline health',
      'Provides unified governance across corporate machine learning models'
    ],
    setupTime: '45 seconds',
    idealFor: 'Data Architects, ML Engineers & Heads of AI',
    securityNote: 'Personal access token with scoped catalog read permissions'
  },
  segment: {
    friendlyCategory: 'Customer Data Platform',
    tagline: 'Customer event tracking, cross-system identity resolution, and user funnels.',
    whatItProtects: [
      'Monitors event delivery pipelines to ensure zero lost customer interactions',
      'Validates tracking plan schema compliance to prevent bad data in analytics',
      'Harmonizes customer identity across website, mobile, and product apps'
    ],
    setupTime: '20 seconds',
    idealFor: 'Growth Engineers, Product Managers & Marketers',
    securityNote: 'Write key validation without customer PII storage'
  },
  posthog: {
    friendlyCategory: 'Product Analytics',
    tagline: 'Feature flags, product adoption funnels, session analytics, and user retention.',
    whatItProtects: [
      'Monitors feature flag rollouts to ensure phased releases do not break production',
      'Tracks user onboarding drop-off points with verified conversion funnels',
      'Surfaces session recordings of users experiencing checkout or billing errors'
    ],
    setupTime: '25 seconds',
    idealFor: 'Product Managers, Growth Leads & Frontend Engineers',
    securityNote: 'Read-only API access to aggregated insights and flags'
  },
  mixpanel: {
    friendlyCategory: 'Product Analytics',
    tagline: 'User conversion cohorts, multi-touch product paths, and active monthly users.',
    whatItProtects: [
      'Calculates exact daily and monthly active user (DAU/MAU) engagement trends',
      'Surfaces critical conversion funnel bottlenecks across pricing tiers',
      'Provides cohort retention curves for investor and board presentations'
    ],
    setupTime: '25 seconds',
    idealFor: 'Product Leaders & Growth Marketing Executives',
    securityNote: 'Project token read access to aggregated cohort reports'
  },
  datadog: {
    friendlyCategory: 'Cloud Observability',
    tagline: 'Cloud infrastructure metrics, APM service latencies, and critical error monitors.',
    whatItProtects: [
      'Alerts executives when core API latencies breach acceptable customer SLA thresholds',
      'Correlates infrastructure CPU/memory spikes with customer usage surges',
      'Monitors synthetic tests verifying website and checkout availability'
    ],
    setupTime: '30 seconds',
    idealFor: 'DevOps Leads, Platform Engineers & CTOs',
    securityNote: 'API and Application key with read-only monitor permissions'
  },
  sentry: {
    friendlyCategory: 'Error Tracking & APM',
    tagline: 'Production exception crashes, affected customer counts, and release regressions.',
    whatItProtects: [
      'Flags sudden spikes in unhandled runtime exceptions immediately after deployments',
      'Identifies high-value enterprise accounts impacted by software bugs',
      'Maintains error budget tracking for engineering reliability targets'
    ],
    setupTime: '25 seconds',
    idealFor: 'Frontend Leads, Backend Engineers & VP of Engineering',
    securityNote: 'Auth token scoped to project:read and issue:read'
  },
  aws: {
    friendlyCategory: 'Cloud Infrastructure',
    tagline: 'Enterprise cloud spending, compute cost forecasts, and utilization alarms.',
    whatItProtects: [
      'Alerts finance when monthly AWS spending exceeds budget forecast limits',
      'Identifies unattached EBS volumes and oversized EC2 instances wasting capital',
      'Monitors critical CloudWatch alarms across production databases'
    ],
    setupTime: '40 seconds',
    idealFor: 'FinOps Practitioners, Cloud Architects & CFOs',
    securityNote: 'IAM user or role with ReadOnlyAccess / CloudWatch read policies'
  },

  // HR & OPERATIONS
  workday: {
    friendlyCategory: 'HR & HCM',
    tagline: 'Enterprise employee roster, headcount cost planning, and org hierarchy.',
    whatItProtects: [
      'Correlates planned headcount hiring against departmental salary budgets',
      'Maintains an authoritative corporate organizational hierarchy tree',
      'Verifies employee termination events for timely IT access deprovisioning'
    ],
    setupTime: '60 seconds',
    idealFor: 'Chief People Officers, HR Directors & Compensation Leads',
    securityNote: 'OAuth 2.0 Integration System User with strict report scoping'
  },
  rippling: {
    friendlyCategory: 'Workforce Platform',
    tagline: 'Global payroll execution, device management, and employee onboarding.',
    whatItProtects: [
      'Monitors upcoming payroll execution deadlines and direct deposit requirements',
      'Ensures departed employees have access revoked across all corporate software',
      'Tracks employee device inventory and corporate security compliance'
    ],
    setupTime: '30 seconds',
    idealFor: 'People Operations, IT Admins & Financial Controllers',
    securityNote: 'Scoped API key with read-only workforce directory access'
  },
  deel: {
    friendlyCategory: 'Global Payroll',
    tagline: 'International contractor contracts, compliance filings, and foreign payouts.',
    whatItProtects: [
      'Ensures global contractor agreements comply with local labor classification laws',
      'Tracks international invoice approvals and multi-currency payouts',
      'Maintains audit-ready tax documentation for all international hires'
    ],
    setupTime: '30 seconds',
    idealFor: 'Global Operations Directors & People Leaders',
    securityNote: 'Read-only API key configuration'
  },
  gusto: {
    friendlyCategory: 'Payroll & Benefits',
    tagline: 'Domestic payroll runs, direct deposits, health benefits, and tax filings.',
    whatItProtects: [
      'Warns payroll admins if a bi-weekly payroll run is approaching without submission',
      'Tracks payroll tax filing compliance and state unemployment payments',
      'Reconciles health insurance and 401(k) employee benefit deductions'
    ],
    setupTime: '35 seconds',
    idealFor: 'Small Business Owners, HR Managers & Bookkeepers',
    securityNote: 'OAuth 2.0 with read-only payroll and employee scopes'
  },
  bamboohr: {
    friendlyCategory: 'People Operations',
    tagline: 'Company staff directory, paid time off (PTO) requests, and job openings.',
    whatItProtects: [
      'Prevents understaffing by tracking overlapping executive PTO requests',
      'Maintains accurate staff contact information for emergency broadcasts',
      'Tracks open job requisition velocity and candidate pipeline stages'
    ],
    setupTime: '25 seconds',
    idealFor: 'HR Coordinators & People Operations Managers',
    securityNote: 'API key with subdomain validation'
  },

  // SECURITY & COMPLIANCE
  vanta: {
    friendlyCategory: 'Security & Compliance',
    tagline: 'Automated SOC 2 / ISO 27001 controls, security test monitoring, and vendor risk.',
    whatItProtects: [
      'Alerts leadership immediately when a continuous security test fails',
      'Ensures all employee background checks and training modules are completed',
      'Maintains continuous audit evidence ready for enterprise buyer security reviews'
    ],
    setupTime: '30 seconds',
    idealFor: 'CISOs, Security Leads & Compliance Officers',
    securityNote: 'OAuth 2.0 application with read-only compliance queries'
  },
  drata: {
    friendlyCategory: 'Compliance Automation',
    tagline: 'Audit readiness monitoring, automated evidence collection, and security training.',
    whatItProtects: [
      'Tracks overall company compliance percentage across SOC 2 and GDPR frameworks',
      'Flags non-compliant employee workstations missing disk encryption or passwords',
      'Collects immutable cryptographic evidence logs for certified auditor review'
    ],
    setupTime: '30 seconds',
    idealFor: 'Security Directors, IT Managers & Risk Committees',
    securityNote: 'API token with read-only evidence and personnel scopes'
  },
  google_maps: {
    friendlyCategory: 'Spatial & Logistics',
    tagline: 'Spatial fleet intelligence, geocoding validation, route logistics, and customer location verification.',
    whatItProtects: [
      'Verifies commercial delivery addresses and customer shipping destinations',
      'Calculates accurate route ETAs and logistics dispatch travel times',
      'Monitors geographic cluster density of enterprise customer installations'
    ],
    setupTime: '20 seconds',
    idealFor: 'Logistics Operators, Field Service Teams & Fleet Directors',
    securityNote: 'API key with HTTP referer restriction capabilities'
  }
};
