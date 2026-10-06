import React, { useState } from 'react';

export type ConnectorId = 
  | 'salesforce'
  | 'quickbooks'
  | 'gmail'
  | 'zendesk'
  | 'stripe'
  | 'google_calendar'
  | 'slack'
  | 'github'
  | 'linear'
  | 'hubspot'
  | 'docusign'
  | 'mercury'
  | 'intercom'
  | 'snowflake'
  | 'jira'
  | 'netsuite'
  | 'ironclad'
  | 'posthog'
  | 'ramp'
  | 'brex'
  | 'billcom'
  | 'xero'
  | 'chargebee'
  | 'workday'
  | 'sap'
  | 'gong'
  | 'outreach'
  | 'salesloft'
  | 'apollo'
  | 'zoominfo'
  | 'msteams'
  | 'outlook'
  | 'googledrive'
  | 'notion'
  | 'asana'
  | 'monday'
  | 'clickup'
  | 'coda'
  | 'gainsight'
  | 'churnzero'
  | 'freshdesk'
  | 'gitlab'
  | 'datadog'
  | 'sentry'
  | 'pagerduty'
  | 'aws'
  | 'mixpanel'
  | 'segment'
  | 'databricks'
  | 'bigquery'
  | 'pandadoc'
  | 'rippling'
  | 'deel'
  | 'gusto'
  | 'bamboohr'
  | 'vanta'
  | 'drata'
  | 'figma'
  | string;

export interface ConnectorLogoProps {
  id?: ConnectorId;
  toolId?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  badge?: boolean;
}

const SIZE_MAP = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40
};

// Canonical mapping of official downloaded assets in /public/logos/
const OFFICIAL_LOGO_ASSETS: Record<string, string> = {
  salesforce: '/logos/salesforce.svg',
  quickbooks: '/logos/quickbooks.svg',
  gmail: '/logos/gmail.svg',
  zendesk: '/logos/zendesk.svg',
  stripe: '/logos/stripe.svg',
  google_calendar: '/logos/google_calendar.svg',
  googlecalendar: '/logos/google_calendar.svg',
  slack: '/logos/slack.svg',
  github: '/logos/github.svg',
  linear: '/logos/linear.svg',
  hubspot: '/logos/hubspot.svg',
  docusign: '/logos/docusign.svg',
  mercury: '/logos/mercury.svg',
  intercom: '/logos/intercom.svg',
  snowflake: '/logos/snowflake.svg',
  jira: '/logos/jira.svg',
  netsuite: '/logos/netsuite.svg',
  ironclad: '/logos/ironclad.svg',
  posthog: '/logos/posthog.svg',
  ramp: '/logos/ramp.svg',
  brex: '/logos/brex.svg',
  billcom: '/logos/billcom.svg',
  xero: '/logos/xero.svg',
  chargebee: '/logos/chargebee.svg',
  workday: '/logos/workday.svg',
  sap: '/logos/sap.svg',
  gong: '/logos/gong.svg',
  outreach: '/logos/outreach.svg',
  salesloft: '/logos/salesloft.svg',
  apollo: '/logos/apollo.svg',
  zoominfo: '/logos/zoominfo.svg',
  msteams: '/logos/msteams.svg',
  teams: '/logos/msteams.svg',
  outlook: '/logos/outlook.svg',
  googledrive: '/logos/googledrive.svg',
  gdrive: '/logos/googledrive.svg',
  notion: '/logos/notion.svg',
  asana: '/logos/asana.svg',
  monday: '/logos/monday.svg',
  clickup: '/logos/clickup.svg',
  coda: '/logos/coda.svg',
  gainsight: '/logos/gainsight.svg',
  churnzero: '/logos/churnzero.svg',
  freshdesk: '/logos/freshdesk.svg',
  gitlab: '/logos/gitlab.svg',
  datadog: '/logos/datadog.svg',
  sentry: '/logos/sentry.svg',
  pagerduty: '/logos/pagerduty.svg',
  aws: '/logos/aws.svg',
  mixpanel: '/logos/mixpanel.svg',
  segment: '/logos/segment.svg',
  databricks: '/logos/databricks.svg',
  bigquery: '/logos/bigquery.svg',
  pandadoc: '/logos/pandadoc.svg',
  rippling: '/logos/rippling.svg',
  deel: '/logos/deel.svg',
  gusto: '/logos/gusto.svg',
  bamboohr: '/logos/bamboohr.svg',
  vanta: '/logos/vanta.svg',
  drata: '/logos/drata.svg',
  figma: '/logos/figma.svg'
};

// Normalizes raw IDs, action tags, and service names to a clean canonical brand key
export function resolveConnectorKey(rawId?: string, rawToolId?: string, rawName?: string): string {
  const input = (rawId || rawToolId || '').toLowerCase().trim();
  const name = (rawName || '').toLowerCase().trim();

  // Action ID or Log ID prefix detection (e.g. 'sf-act-1', 'log-sf-1' -> salesforce)
  if (input.startsWith('sf-') || input.includes('salesforce') || name.includes('salesforce')) return 'salesforce';
  if (input.startsWith('qb-') || input.includes('quickbooks') || input.includes('intuit') || name.includes('quickbooks')) return 'quickbooks';
  if (input.startsWith('gm-') || input.includes('gmail') || name.includes('gmail')) return 'gmail';
  if (input.startsWith('zd-') || input.includes('zendesk') || name.includes('zendesk')) return 'zendesk';
  if (input.startsWith('st-') || input.includes('stripe') || name.includes('stripe')) return 'stripe';
  if (input.startsWith('cal-') || input.includes('calendar') || input.includes('gcal') || name.includes('calendar')) return 'google_calendar';
  if (input.startsWith('sl-') || input.includes('slack') || name.includes('slack')) return 'slack';
  if (input.startsWith('gh-') || input.includes('github') || name.includes('github')) return 'github';
  if (input.startsWith('lin-') || input.includes('linear') || name.includes('linear')) return 'linear';
  if (input.startsWith('hs-') || input.includes('hubspot') || name.includes('hubspot')) return 'hubspot';
  if (input.startsWith('ds-') || input.includes('docusign') || name.includes('docusign')) return 'docusign';
  if (input.startsWith('mer-') || input.includes('mercury') || name.includes('mercury')) return 'mercury';
  if (input.startsWith('int-') || input.includes('intercom') || name.includes('intercom')) return 'intercom';
  if (input.startsWith('snw-') || input.includes('snowflake') || name.includes('snowflake')) return 'snowflake';
  if (input.startsWith('jira-') || input.includes('jira') || name.includes('jira')) return 'jira';
  if (input.startsWith('ns-') || input.includes('netsuite') || name.includes('netsuite')) return 'netsuite';
  if (input.startsWith('ic-') || input.includes('ironclad') || name.includes('ironclad')) return 'ironclad';
  if (input.startsWith('ph-') || input.includes('posthog') || name.includes('posthog')) return 'posthog';
  if (input.startsWith('ramp-') || input.includes('ramp') || name.includes('ramp')) return 'ramp';
  if (input.startsWith('brex-') || input.includes('brex') || name.includes('brex')) return 'brex';
  if (input.startsWith('bill-') || input.includes('billcom') || input.includes('bill.com') || name.includes('bill')) return 'billcom';
  if (input.startsWith('xero-') || input.includes('xero') || name.includes('xero')) return 'xero';
  if (input.startsWith('cb-') || input.includes('chargebee') || name.includes('chargebee')) return 'chargebee';
  if (input.startsWith('wd-') || input.includes('workday') || name.includes('workday')) return 'workday';
  if (input.startsWith('sap-') || input.includes('sap') || name.includes('sap')) return 'sap';
  if (input.startsWith('gong-') || input.includes('gong') || name.includes('gong')) return 'gong';
  if (input.startsWith('out-') || input.includes('outreach') || name.includes('outreach')) return 'outreach';
  if (input.startsWith('slft-') || input.includes('salesloft') || name.includes('salesloft')) return 'salesloft';
  if (input.startsWith('apo-') || input.includes('apollo') || name.includes('apollo')) return 'apollo';
  if (input.startsWith('zi-') || input.includes('zoominfo') || name.includes('zoominfo')) return 'zoominfo';
  if (input.startsWith('teams-') || input.includes('msteams') || input.includes('teams') || name.includes('teams')) return 'msteams';
  if (input.startsWith('outl-') || input.includes('outlook') || input.includes('office365') || name.includes('outlook')) return 'outlook';
  if (input.startsWith('gdrv-') || input.includes('googledrive') || input.includes('gdrive') || name.includes('drive')) return 'googledrive';
  if (input.startsWith('not-') || input.includes('notion') || name.includes('notion')) return 'notion';
  if (input.startsWith('asa-') || input.includes('asana') || name.includes('asana')) return 'asana';
  if (input.startsWith('mon-') || input.includes('monday') || name.includes('monday')) return 'monday';
  if (input.startsWith('clk-') || input.includes('clickup') || name.includes('clickup')) return 'clickup';
  if (input.startsWith('coda-') || input.includes('coda') || name.includes('coda')) return 'coda';
  if (input.startsWith('gs-') || input.includes('gainsight') || name.includes('gainsight')) return 'gainsight';
  if (input.startsWith('cz-') || input.includes('churnzero') || name.includes('churnzero')) return 'churnzero';
  if (input.startsWith('fd-') || input.includes('freshdesk') || name.includes('freshdesk')) return 'freshdesk';
  if (input.startsWith('gl-') || input.includes('gitlab') || name.includes('gitlab')) return 'gitlab';
  if (input.startsWith('dd-') || input.includes('datadog') || name.includes('datadog')) return 'datadog';
  if (input.startsWith('sen-') || input.includes('sentry') || name.includes('sentry')) return 'sentry';
  if (input.startsWith('pd-') || input.includes('pagerduty') || name.includes('pagerduty')) return 'pagerduty';
  if (input.startsWith('aws-') || input.includes('aws') || input.includes('amazon') || name.includes('aws')) return 'aws';
  if (input.startsWith('mix-') || input.includes('mixpanel') || name.includes('mixpanel')) return 'mixpanel';
  if (input.startsWith('seg-') || input.includes('segment') || name.includes('segment')) return 'segment';
  if (input.startsWith('db-') || input.includes('databricks') || name.includes('databricks')) return 'databricks';
  if (input.startsWith('bq-') || input.includes('bigquery') || name.includes('bigquery')) return 'bigquery';
  if (input.startsWith('pan-') || input.includes('pandadoc') || name.includes('pandadoc')) return 'pandadoc';
  if (input.startsWith('rip-') || input.includes('rippling') || name.includes('rippling')) return 'rippling';
  if (input.startsWith('deel-') || input.includes('deel') || name.includes('deel')) return 'deel';
  if (input.startsWith('gus-') || input.includes('gusto') || name.includes('gusto')) return 'gusto';
  if (input.startsWith('bam-') || input.includes('bamboohr') || name.includes('bamboohr')) return 'bamboohr';
  if (input.startsWith('van-') || input.includes('vanta') || name.includes('vanta')) return 'vanta';
  if (input.startsWith('dra-') || input.includes('drata') || name.includes('drata')) return 'drata';
  if (input.includes('figma') || name.includes('figma')) return 'figma';
  if (input.includes('safe') || name.includes('safe')) return 'gnosis_safe';
  if (input.includes('evm') || input.includes('ethereum') || name.includes('ethereum')) return 'evm_treasury';
  if (input.includes('solana') || name.includes('solana')) return 'solana_treasury';
  if (input.includes('coinbase') || name.includes('coinbase')) return 'coinbase_institutional';
  if (input.includes('etherscan') || input.includes('dune') || name.includes('etherscan')) return 'etherscan';
  if (input.includes('bitcoin') || input.includes('btc') || name.includes('bitcoin')) return 'bitcoin_treasury';

  // Fallback direct strip
  return input.replace(/[-_ ]/g, '');
}

export const ConnectorLogo: React.FC<ConnectorLogoProps> = ({
  id,
  toolId,
  name,
  size = 'md',
  className = '',
  badge = false
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 24;
  const canonicalKey = resolveConnectorKey(id, toolId, name);
  const assetPath = OFFICIAL_LOGO_ASSETS[canonicalKey];

  // High-fidelity inline vector fallback in case image fails to load or before it loads
  const renderFallbackVector = () => {
    switch (canonicalKey) {
      // 1. Salesforce (Official Cloud)
      case 'salesforce':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path
              d="M17.4 8.7a5.2 5.2 0 0 0-4.2-2.1 5.1 5.1 0 0 0-4.8 3.3 4.2 4.2 0 0 0-3.4 4.1c0 2.3 1.9 4.2 4.2 4.2h10.4c2.1 0 3.8-1.7 3.8-3.8 0-1.9-1.4-3.5-3.3-3.7-.1-.7-.8-1.5-1.7-2z"
              fill="#00A1E0"
            />
          </svg>
        );

      // 2. QuickBooks (Intuit Green Ring)
      case 'quickbooks':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#2CA01C" />
            <path d="M10.2 7.5v5.8a1.9 1.9 0 1 1-1.9-1.9h.9V7.5h-.9a3.3 3.3 0 1 0 3.3 3.3V7.5h-1.4z" fill="#FFFFFF" />
            <path d="M13.8 16.5v-5.8a1.9 1.9 0 1 1 1.9 1.9h-.9v3.9h.9a3.3 3.3 0 1 0-3.3-3.3v3.3h1.4z" fill="#FFFFFF" />
          </svg>
        );

      // 3. Gmail (Official 4-Color Envelope)
      case 'gmail':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path d="M4 19V7.5l8 6 8-6V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" fill="#EAEAEA" />
            <path d="M4 7.5V6a1 1 0 0 1 1-1h1.5l5.5 4.1L4 13.5V7.5z" fill="#4285F4" />
            <path d="M20 7.5V6a1 1 0 0 0-1-1h-1.5l-5.5 4.1 6 4.5V7.5z" fill="#EA4335" />
            <path d="M4 19v-5.5l4-3v7.5H5a1 1 0 0 1-1-1z" fill="#34A853" />
            <path d="M20 19v-5.5l-4-3v7.5h3a1 1 0 0 0 1-1z" fill="#FBBC05" />
            <path d="M4 7.5L12 13.5l8-6L18 5H6L4 7.5z" fill="#EA4335" />
          </svg>
        );

      // 4. Zendesk (Official Geometric Z)
      case 'zendesk':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path d="M5 5a6 6 0 0 1 6 6H5V5z" fill="#03363D" />
            <path d="M19 11L13 5v6h6z" fill="#03363D" />
            <path d="M5 13l6 6v-6H5z" fill="#03363D" />
            <path d="M19 19a6 6 0 0 1-6-6h6v6z" fill="#03363D" />
          </svg>
        );

      // 5. Stripe (Official Purple Badge)
      case 'stripe':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <rect width="24" height="24" rx="5" fill="#635BFF" />
            <path
              d="M14.07 9.17c0-.98-.8-1.46-2.12-1.46-1.74 0-3.48.56-4.84 1.48V5.4c1.55-.67 3.39-1.08 5.14-1.08 4.09 0 6.78 2.11 6.78 5.48 0 5.34-7.34 4.47-7.34 6.77 0 1.05.94 1.48 2.29 1.48 1.98 0 3.97-.79 5.38-1.85v3.83c-1.68.89-3.83 1.28-5.79 1.28-4.24 0-6.89-2.12-6.89-5.53 0-5.57 7.39-4.57 7.39-6.61z"
              fill="#FFFFFF"
            />
          </svg>
        );

      // 6. Google Calendar (Sheet with 31)
      case 'google_calendar':
      case 'googlecalendar':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <rect x="4" y="4" width="16" height="16" rx="3.5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
            <path d="M4 8.5h16V5a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 0 4 5v3.5z" fill="#4285F4" />
            <path d="M4 18.5V8.5h4v11.5H5.5A1.5 1.5 0 0 1 4 18.5z" fill="#34A853" />
            <path d="M16 8.5h4v10a1.5 1.5 0 0 1-1.5 1.5H16V8.5z" fill="#FBBC05" />
            <path d="M8 18.5h8V20H8v-1.5z" fill="#EA4335" />
            <text x="12" y="16" textAnchor="middle" fill="#1E293B" fontSize="6.5" fontWeight="800" fontFamily="sans-serif">
              31
            </text>
          </svg>
        );

      // 7. Slack (Official 4-Color Hash)
      case 'slack':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path d="M5.5 10.5a1.5 1.5 0 1 1 0-3h3.5v3H5.5z" fill="#E01E5A" />
            <path d="M10.5 5.5a1.5 1.5 0 0 1 3 0v3.5h-3V5.5z" fill="#36C5F0" />
            <path d="M18.5 13.5a1.5 1.5 0 0 1 0 3h-3.5v-3h3.5z" fill="#2EB67D" />
            <path d="M13.5 18.5a1.5 1.5 0 0 1-3 0v-3.5h3v3.5z" fill="#ECB22E" />
            <circle cx="7" cy="15.5" r="1.5" fill="#E01E5A" />
            <circle cx="8.5" cy="7" r="1.5" fill="#36C5F0" />
            <circle cx="17" cy="8.5" r="1.5" fill="#2EB67D" />
            <circle cx="15.5" cy="17" r="1.5" fill="#ECB22E" />
          </svg>
        );

      // 8. GitHub (Octocat Silhouette)
      case 'github':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <rect width="24" height="24" rx="5" fill="#181717" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12 4C7.58 4 4 7.58 4 12c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 20 12c0-4.42-3.58-8-8-8z"
              fill="#FFFFFF"
            />
          </svg>
        );

      // 9. Linear (Official Spiral)
      case 'linear':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <rect width="24" height="24" rx="5" fill="#121316" />
            <path
              d="M5.5 12a6.5 6.5 0 0 1 6.5-6.5c3.59 0 6.5 2.91 6.5 6.5s-2.91 6.5-6.5 6.5a6.5 6.5 0 0 1-6.5-6.5z"
              stroke="#5E6AD2"
              strokeWidth="2.2"
              strokeDasharray="30 12"
            />
          </svg>
        );

      // 10. HubSpot (Sprocket)
      case 'hubspot':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <circle cx="12" cy="12" r="3.2" fill="#FF7A59" />
            <circle cx="17.5" cy="8.5" r="2.2" fill="#FF7A59" />
            <circle cx="12" cy="4" r="1.6" fill="#FF7A59" />
            <path d="M12 5.5v3.3M14.5 10.2l1.6-1" stroke="#FF7A59" strokeWidth="1.6" />
            <circle cx="6.5" cy="12" r="2" fill="#FF7A59" />
            <path d="M8.5 12h-2M15.2 12h2.5" stroke="#FF7A59" strokeWidth="1.6" />
          </svg>
        );

      // 11. Safe{Wallet} / Gnosis Safe (Green Shield / Key)
      case 'gnosis_safe':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <rect width="24" height="24" rx="5" fill="#12FF80" />
            <path d="M12 5.5l5.5 3v4.2c0 3.8-2.5 6.8-5.5 7.8-3-1-5.5-4-5.5-7.8V8.5L12 5.5z" fill="#141414" />
            <path d="M12 9.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 5.5c-1.3 0-2.5.6-3 1.5.8.5 2 .8 3 .8s2.2-.3 3-.8c-.5-.9-1.7-1.5-3-1.5z" fill="#12FF80" />
          </svg>
        );

      // 12. Ethereum & EVM Multi-Chain Watchtower
      case 'evm_treasury':
      case 'ethereum':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <rect width="24" height="24" rx="5" fill="#24292E" />
            <path d="M12 3.5l-5 8.2 5 2.8 5-2.8-5-8.2z" fill="#8A92B2" />
            <path d="M12 3.5v11l5-2.8-5-8.2z" fill="#627EEA" />
            <path d="M12 15.5l-5-2.8 5 7.8 5-7.8-5 2.8z" fill="#8A92B2" />
            <path d="M12 15.5v7.8l5-7.8-5 2.8z" fill="#627EEA" />
          </svg>
        );

      // 13. Solana Corporate Vault Observer
      case 'solana_treasury':
      case 'solana':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <rect width="24" height="24" rx="5" fill="#000000" />
            <path d="M6 7.2h10.8l2.2-2.2H8.2L6 7.2z" fill="#00FFA3" />
            <path d="M18 12.5H7.2L5 14.7h10.8l2.2-2.2z" fill="#DC1FFF" />
            <path d="M6 19.5h10.8l2.2-2.2H8.2L6 19.5z" fill="#00FFA3" />
          </svg>
        );

      // 14. Coinbase Prime & Institutional Custody
      case 'coinbase_institutional':
      case 'coinbase':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#0052FF" />
            <rect x="8.5" y="8.5" width="7" height="7" rx="1.5" fill="#FFFFFF" />
          </svg>
        );

      // 15. Etherscan & Dune Analytics Ledger Indexer
      case 'etherscan':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#1B365D" />
            <path d="M12 6.5a5.5 5.5 0 0 0-5.5 5.5c0 2.2 1.3 4.1 3.2 4.9v-2.2a3.3 3.3 0 0 1-1-2.7c0-1.8 1.5-3.3 3.3-3.3s3.3 1.5 3.3 3.3c0 1-.5 2-1.3 2.6l1.6 1.6c1.5-1.1 2.3-2.8 2.3-4.2 0-3-2.5-5.5-5.9-5.5z" fill="#FFFFFF" />
            <circle cx="12" cy="12" r="1.5" fill="#3498DB" />
          </svg>
        );

      // 16. Bitcoin Strategic Reserve Watcher
      case 'bitcoin_treasury':
      case 'bitcoin':
        return (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#F7931A" />
            <path d="M15.2 10.4c.3-1.8-1.1-2.8-3-3.4l.6-2.4-1.5-.4-.6 2.3c-.4-.1-.8-.2-1.2-.3l.6-2.4-1.5-.4-.6 2.4c-.3-.1-.7-.2-1-.2L5.4 6l-.3 1.2s.8.2.8.2c.5.1.5.7.5 1l-.5 2.1c0 0 .1 0 .2.1h-.2l-.7 2.8c-.1.3-.3.8-.8.6 0 0-.8-.2-.8-.2l-.6 1.4 1.5.4c.3.1.6.2.9.2l-.6 2.5 1.5.4.6-2.4c.4.1.8.2 1.2.3l-.6 2.4 1.5.4.6-2.5c2.6.5 4.5.3 5.3-2 .7-1.9 0-3-1.4-3.7 1-.2 1.8-.9 2-2.3zm-3.6 5c-.5 1.9-3.7.9-4.7.6l.8-3.4c1 .3 4.4 1 3.9 2.8zm.5-5.1c-.4 1.7-3.1.9-4 .6l.8-3.1c.9.2 3.6.7 3.2 2.5z" fill="#FFFFFF" />
          </svg>
        );

      // Default Clean Monogram Gateway
      default:
        return (
          <div className="w-full h-full rounded-md bg-stone-800 text-white font-bold flex items-center justify-center text-[10px] uppercase font-mono shadow-2xs">
            {canonicalKey.slice(0, 2) || 'SD'}
          </div>
        );
    }
  };

  const containerStyle = {
    width: `${pixelSize}px`,
    height: `${pixelSize}px`
  };

  // Render the authentic downloaded logo asset with clean fallback
  const renderLogoContent = () => {
    if (!assetPath || imgFailed) {
      return renderFallbackVector();
    }

    return (
      <img
        src={assetPath}
        alt={name || canonicalKey}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className="w-full h-full object-contain pointer-events-none select-none transition-transform hover:scale-105"
      />
    );
  };

  if (badge) {
    return (
      <div 
        className={`inline-flex items-center justify-center p-1.5 rounded-xl bg-white border border-stone-200/90 shadow-2xs shrink-0 transition-all hover:border-stone-300 ${className}`}
        style={{ width: `${pixelSize + 12}px`, height: `${pixelSize + 12}px` }}
      >
        <div style={containerStyle} className="flex items-center justify-center overflow-hidden">
          {renderLogoContent()}
        </div>
      </div>
    );
  }

  return (
    <div 
      style={containerStyle} 
      className={`inline-flex items-center justify-center shrink-0 overflow-hidden ${className}`}
      title={name || id || canonicalKey}
    >
      {renderLogoContent()}
    </div>
  );
};
