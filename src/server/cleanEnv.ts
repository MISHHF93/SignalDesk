/**
 * Safely retrieve trimmed environment variable without '[object Object]' or 'undefined' artifacts.
 * Safe to import in both client-side (browser) and server-side (Node.js) environments.
 */
export function getCleanEnv(varName: string): string {
  try {
    if (typeof process !== 'undefined' && process.env) {
      const val = process.env[varName];
      if (typeof val === 'string' && val.trim() && !val.includes('[object') && !val.includes('undefined')) {
        return val.trim();
      }
    }
  } catch {
    // browser or sandboxed execution environment fallback
  }
  return '';
}

/**
 * Returns the validated canonical production HTTPS origin.
 * Priority: CANONICAL_APP_URL > APP_URL > VITE_APP_URL > request host > fallback
 *
 * In Production: https://app.signaldesk.com
 * OAuth Callback: https://app.signaldesk.com/auth/callback
 */
export function getCanonicalProductionOrigin(reqHost?: string, reqProto?: string): string {
  const envUrl = getCleanEnv('CANONICAL_APP_URL') || getCleanEnv('APP_URL') || getCleanEnv('VITE_APP_URL');
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }
  if (reqHost && !reqHost.includes('localhost') && !reqHost.includes('127.0.0.1')) {
    const proto = reqProto || 'https';
    return `${proto}://${reqHost}`.replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.K_SERVICE?.includes('dev')) {
    return 'https://app.signaldesk.com';
  }
  // Development default
  return 'https://ais-dev-62pwdxf3jegq4yodmb42gy-423433823926.us-west2.run.app';
}
