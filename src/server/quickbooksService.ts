/**
 * QuickBooks Sandbox OAuth 2.0 Service & Ingress
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: 'sandbox' | 'production';
  scopes: string[];
}

export interface QuickBooksTokenStore {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  realmId?: string;
  obtained_at: number;
}

const TOKEN_FILE_PATH = path.join(process.cwd(), '.quickbooks_tokens.json');

export const DEFAULT_QB_CONFIG: QuickBooksConfig = {
  clientId: process.env.QUICKBOOKS_CLIENT_ID || 'ABBkAFKbDJcgcK9MzSBveS5agPG3gZM3qSbH51GFxh6MmRaSf1',
  clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
  redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || 'https://developer.intuit.com/app/developer/quickstart',
  environment: (process.env.QUICKBOOKS_ENVIRONMENT as any) || 'sandbox',
  scopes: [
    'com.intuit.quickbooks.accounting',
    'com.intuit.quickbooks.payment',
    'openid',
    'profile',
    'email',
    'phone',
    'address'
  ]
};

const DISCOVERY = {
  sandbox: {
    authorization_endpoint: 'https://appcenter.intuit.com/connect/oauth2',
    token_endpoint: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    api_base_url: 'https://sandbox-quickbooks.api.intuit.com'
  },
  production: {
    authorization_endpoint: 'https://appcenter.intuit.com/connect/oauth2',
    token_endpoint: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    api_base_url: 'https://quickbooks.api.intuit.com'
  }
};

export function getAuthorizationUrl(config = DEFAULT_QB_CONFIG, state?: string): { url: string; state: string } {
  const endpoints = DISCOVERY[config.environment];
  const secureState = state || crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: config.scopes.join(' '),
    redirect_uri: config.redirectUri,
    state: secureState
  });

  return {
    url: `${endpoints.authorization_endpoint}?${params.toString()}`,
    state: secureState
  };
}

export async function exchangeCodeForTokens(
  code: string,
  realmId: string,
  config = DEFAULT_QB_CONFIG
): Promise<QuickBooksTokenStore> {
  const endpoints = DISCOVERY[config.environment];
  const secret = config.clientSecret || process.env.QUICKBOOKS_CLIENT_SECRET || '';
  if (!secret) {
    throw new Error('QUICKBOOKS_CLIENT_SECRET is not configured.');
  }

  const basicAuth = Buffer.from(`${config.clientId}:${secret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri
  });

  const response = await fetch(endpoints.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json'
    },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const tokens: QuickBooksTokenStore = {
    ...data,
    realmId,
    obtained_at: Date.now()
  };

  saveTokens(tokens);
  return tokens;
}

export async function refreshAccessToken(config = DEFAULT_QB_CONFIG): Promise<QuickBooksTokenStore> {
  const existing = loadTokens();
  if (!existing || !existing.refresh_token) {
    throw new Error('No existing refresh token found.');
  }

  const secret = config.clientSecret || process.env.QUICKBOOKS_CLIENT_SECRET || '';
  if (!secret) {
    throw new Error('QUICKBOOKS_CLIENT_SECRET is not configured.');
  }

  const endpoints = DISCOVERY[config.environment];
  const basicAuth = Buffer.from(`${config.clientId}:${secret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: existing.refresh_token
  });

  const response = await fetch(endpoints.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json'
    },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const updated: QuickBooksTokenStore = {
    ...existing,
    ...data,
    obtained_at: Date.now()
  };

  saveTokens(updated);
  return updated;
}

export function saveTokens(tokens: QuickBooksTokenStore): void {
  try {
    fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write tokens file:', e);
  }
}

export function loadTokens(): QuickBooksTokenStore | null {
  try {
    if (!fs.existsSync(TOKEN_FILE_PATH)) return null;
    const raw = fs.readFileSync(TOKEN_FILE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export async function queryCompanyInfo(config = DEFAULT_QB_CONFIG) {
  const tokens = loadTokens();
  if (!tokens || !tokens.access_token || !tokens.realmId) {
    throw new Error('Missing valid tokens or realmId. Complete authorization first.');
  }

  const endpoints = DISCOVERY[config.environment];
  const url = `${endpoints.api_base_url}/v3/company/${tokens.realmId}/companyinfo/${tokens.realmId}?minorversion=73`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      console.log('[QuickBooks] Token expired, refreshing...');
      await refreshAccessToken(config);
      return queryCompanyInfo(config);
    }
    const err = await response.text();
    throw new Error(`API query failed (${response.status}): ${err}`);
  }

  return response.json();
}
