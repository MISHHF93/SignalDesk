/**
 * QuickBooks Sandbox OAuth 2.0 CLI Runner
 */
import {
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  loadTokens,
  queryCompanyInfo,
  DEFAULT_QB_CONFIG
} from '../src/server/quickbooksService';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log('--- QuickBooks Sandbox OAuth 2.0 Runner ---');

  if (command === 'authorize') {
    const auth = getAuthorizationUrl();
    console.log('\nStep 1: Open this URL in your browser:');
    console.log(auth.url);
    console.log('\nState Parameter:', auth.state);
    console.log('\nAfter user consent, Intuit will redirect to your redirect_uri with ?code=...&realmId=...');
  } else if (command === 'exchange') {
    const code = args[1];
    const realmId = args[2];
    if (!code || !realmId) {
      console.error('Usage: npx tsx scripts/quickbooks_oauth.ts exchange <code> <realmId>');
      process.exit(1);
    }
    console.log(`Exchanging code for realmId: ${realmId}...`);
    const tokens = await exchangeCodeForTokens(code, realmId);
    console.log('Success! Access Token expires in:', tokens.expires_in, 'seconds');
  } else if (command === 'refresh') {
    console.log('Refreshing stored token...');
    const tokens = await refreshAccessToken();
    console.log('Success! New Access Token obtained.');
  } else if (command === 'query') {
    console.log('Querying CompanyInfo API...');
    const info = await queryCompanyInfo();
    console.log('Company Info:', JSON.stringify(info, null, 2));
  } else {
    console.log('Commands available:');
    console.log('  authorize                 - Generates authorization URL');
    console.log('  exchange <code> <realmId> - Exchanges auth code for tokens');
    console.log('  refresh                   - Refreshes expired access token');
    console.log('  query                     - Queries CompanyInfo Sandbox API');
  }
}

main().catch(err => {
  console.error('[Error]', err.message);
  process.exit(1);
});
