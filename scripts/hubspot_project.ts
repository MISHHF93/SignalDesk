/**
 * HubSpot Developer Project Generator & Service Key Tool
 * Creates the modern HubSpot Project structure (post-2025/2026 Developer Platform).
 */

import fs from 'fs';
import path from 'path';

const PROJECT_DIR = path.join(process.cwd(), 'hubspot-project');

export const HUBSPOT_APP_META = {
  name: "SignalDesk Sovereign Intelligence",
  description: "Unified cross-system intelligence and CRM event stream for SignalDesk",
  uid: "signaldesk_sovereign_hub",
  scopes: [
    "crm.objects.contacts.read",
    "crm.objects.companies.read",
    "crm.objects.deals.read",
    "crm.objects.tickets.read",
    "crm.objects.invoices.read",
    "crm.objects.subscriptions.read"
  ],
  auth: {
    redirectUrls: [
      "https://ais-dev-62pwdxf3jegq4yodmb42gy-423433823926.us-west2.run.app/auth/callback"
    ]
  },
  webhooks: {
    targetUrl: "https://ais-dev-62pwdxf3jegq4yodmb42gy-423433823926.us-west2.run.app/api/webhooks/hubspot",
    maxConcurrentRequests: 10
  }
};

export function scaffoldHubSpotProject(portalId?: string, personalAccessKey?: string) {
  if (!fs.existsSync(PROJECT_DIR)) {
    fs.mkdirSync(PROJECT_DIR, { recursive: true });
  }

  // 1. app-hsmeta.json
  const appMetaPath = path.join(PROJECT_DIR, 'app-hsmeta.json');
  fs.writeFileSync(appMetaPath, JSON.stringify(HUBSPOT_APP_META, null, 2), 'utf-8');

  // 2. hubspot.config.yml (if personal access key provided)
  if (portalId && personalAccessKey) {
    const configYml = `defaultPortal: "signaldesk-portal"
portals:
  - name: "signaldesk-portal"
    portalId: ${portalId}
    authType: personalaccesskey
    personalAccessKey: "${personalAccessKey}"
`;
    fs.writeFileSync(path.join(PROJECT_DIR, 'hubspot.config.yml'), configYml, 'utf-8');
    fs.writeFileSync(path.join(process.cwd(), 'hubspot.config.yml'), configYml, 'utf-8');
  }

  console.log(`[HubSpot] Project scaffolded at: ${PROJECT_DIR}`);
  console.log(`  - app-hsmeta.json: Configured with 6 core SignalDesk CRM scopes & Webhook URL`);
  if (personalAccessKey) {
    console.log(`  - hubspot.config.yml: Authenticated for portal ${portalId}`);
  }
}

// CLI entry
const args = process.argv.slice(2);
const portalId = args[0];
const key = args[1];
scaffoldHubSpotProject(portalId, key);
