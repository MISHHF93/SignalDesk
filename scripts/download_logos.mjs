import fs from 'fs';
import path from 'path';

const outDir = path.resolve(process.cwd(), 'public/logos');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Map each connector ID to its official source
// Priority 1: Vector SVG (from Iconify logos/simple-icons or VectorLogoZone or Wikimedia)
// Priority 2: High-resolution official brand PNG (from company domain)
const SOURCES = {
  salesforce: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:salesforce.svg'
  },
  quickbooks: {
    type: 'svg',
    url: 'https://api.iconify.design/simple-icons:quickbooks.svg?color=%232ca01c'
  },
  gmail: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:google-gmail.svg'
  },
  zendesk: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:zendesk-icon.svg'
  },
  stripe: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:stripe.svg'
  },
  google_calendar: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:google-calendar.svg'
  },
  slack: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:slack-icon.svg'
  },
  github: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:github-icon.svg'
  },
  linear: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:linear-icon.svg'
  },
  hubspot: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:hubspot.svg'
  },
  docusign: {
    type: 'svg',
    url: 'https://www.vectorlogo.zone/logos/docusign/docusign-icon.svg'
  },
  mercury: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://mercury.com&size=128'
  },
  intercom: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:intercom-icon.svg'
  },
  snowflake: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:snowflake-icon.svg'
  },
  jira: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:jira.svg'
  },
  netsuite: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://netsuite.com&size=128',
    altSvg: 'https://api.iconify.design/cib:oracle-netsuite.svg?color=%231A365D'
  },
  ironclad: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://ironcladapp.com&size=128'
  },
  posthog: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:posthog-icon.svg'
  },
  ramp: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://ramp.com&size=128'
  },
  brex: {
    type: 'svg',
    url: 'https://api.iconify.design/simple-icons:brex.svg?color=%23FF5A1F'
  },
  billcom: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://bill.com&size=128'
  },
  xero: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:xero.svg'
  },
  chargebee: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:chargebee-icon.svg'
  },
  workday: {
    type: 'svg',
    url: 'https://www.vectorlogo.zone/logos/workday/workday-icon.svg'
  },
  sap: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:sap.svg'
  },
  gong: {
    type: 'svg',
    url: 'https://www.vectorlogo.zone/logos/gongio/gongio-icon.svg'
  },
  outreach: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://outreach.io&size=128'
  },
  salesloft: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://salesloft.com&size=128'
  },
  apollo: {
    type: 'svg',
    url: 'https://www.vectorlogo.zone/logos/apolloio/apolloio-icon.svg'
  },
  zoominfo: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://zoominfo.com&size=128'
  },
  msteams: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:microsoft-teams.svg'
  },
  outlook: {
    type: 'svg',
    url: 'https://api.iconify.design/simple-icons:microsoftoutlook.svg?color=%230078D4'
  },
  googledrive: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:google-drive.svg'
  },
  notion: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:notion-icon.svg'
  },
  asana: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:asana-icon.svg'
  },
  monday: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:monday-icon.svg'
  },
  clickup: {
    type: 'svg',
    url: 'https://api.iconify.design/simple-icons:clickup.svg?color=%237B68EE'
  },
  coda: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:coda-icon.svg'
  },
  gainsight: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://gainsight.com&size=128'
  },
  churnzero: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://churnzero.com&size=128'
  },
  freshdesk: {
    type: 'svg',
    url: 'https://www.vectorlogo.zone/logos/freshdesk/freshdesk-icon.svg'
  },
  gitlab: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:gitlab.svg'
  },
  datadog: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:datadog-icon.svg'
  },
  sentry: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:sentry-icon.svg'
  },
  pagerduty: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:pagerduty-icon.svg'
  },
  aws: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:aws.svg'
  },
  mixpanel: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:mixpanel.svg'
  },
  segment: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:segment-icon.svg'
  },
  databricks: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:databricks.svg'
  },
  bigquery: {
    type: 'svg',
    url: 'https://api.iconify.design/simple-icons:googlebigquery.svg?color=%234285F4'
  },
  pandadoc: {
    type: 'svg',
    url: 'https://www.vectorlogo.zone/logos/pandadoc/pandadoc-icon.svg'
  },
  rippling: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://rippling.com&size=128',
    altSvg: 'https://api.iconify.design/thesvg-color:rippling.svg'
  },
  deel: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://deel.com&size=128'
  },
  gusto: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:gusto.svg'
  },
  bamboohr: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://bamboohr.com&size=128'
  },
  vanta: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://vanta.com&size=128'
  },
  drata: {
    type: 'png',
    url: 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://drata.com&size=128'
  },
  figma: {
    type: 'svg',
    url: 'https://api.iconify.design/logos:figma.svg'
  }
};

async function downloadAll() {
  console.log(`Starting download of ${Object.keys(SOURCES).length} connector logos...`);
  const results = { success: 0, failed: 0, files: [] };

  for (const [id, src] of Object.entries(SOURCES)) {
    try {
      const ext = src.type === 'png' ? 'png' : 'svg';
      const dest = path.join(outDir, `${id}.${ext}`);
      
      const res = await fetch(src.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SignalDesk/2026'
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      if (src.type === 'svg') {
        let text = await res.text();
        if (!text.includes('<svg')) {
          throw new Error('Response is not valid SVG');
        }
        // Ensure standard viewBox if missing width/height
        fs.writeFileSync(dest, text, 'utf8');
      } else {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length < 100) {
          throw new Error('Image buffer too small');
        }
        fs.writeFileSync(dest, buffer);
      }

      // If there is an altSvg, also download it
      if (src.altSvg) {
        try {
          const altRes = await fetch(src.altSvg);
          if (altRes.ok) {
            const altText = await altRes.text();
            if (altText.includes('<svg')) {
              fs.writeFileSync(path.join(outDir, `${id}.svg`), altText, 'utf8');
            }
          }
        } catch (e) {}
      }

      // Add aliases (e.g. googlecalendar -> google_calendar, msteams -> teams)
      if (id === 'google_calendar') {
        fs.copyFileSync(dest, path.join(outDir, `googlecalendar.${ext}`));
      } else if (id === 'msteams') {
        fs.copyFileSync(dest, path.join(outDir, `teams.${ext}`));
      } else if (id === 'googledrive') {
        fs.copyFileSync(dest, path.join(outDir, `gdrive.${ext}`));
      }

      results.success++;
      results.files.push(`${id}.${ext}`);
      console.log(`✓ [${results.success}/${Object.keys(SOURCES).length}] ${id} -> ${id}.${ext}`);
    } catch (err) {
      results.failed++;
      console.error(`✗ FAILED: ${id} (${src.url}): ${err.message}`);
    }
  }

  console.log(`Finished: ${results.success} downloaded, ${results.failed} failed.`);
}

downloadAll();
