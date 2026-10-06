import {
  CONNECTOR_REALITY_MATRIX_57,
  OWNER_SETUP_MATRIX_57
} from './matrix57';

export type ConnectorCertificationStatus = 
  | 'CATALOG_ONLY'
  | 'IMPLEMENTED_UNCONFIGURED'
  | 'AUTH_READY'
  | 'READ_VERIFIED'
  | 'SYNC_VERIFIED'
  | 'WRITE_CAPABLE'
  | 'VERIFIED_ACTION_CAPABLE'
  | 'DEGRADED'
  | 'BROKEN'
  | 'REMOVE_FROM_PRODUCTION';

export type ConnectorClassificationType = 'TENANT_BUSINESS_CONNECTOR' | 'PLATFORM_INFRASTRUCTURE';

export interface RealityMatrixEntry {
  providerId: string;
  providerName: string;
  category: string;
  connectorType?: ConnectorClassificationType;
  catalog: boolean;
  authStrategy: 'oauth2_pkce' | 'oauth2_standard' | 'api_key_secret' | 'bearer_token' | 'none';
  credentialsConfigured: boolean;
  identityVerified: boolean;
  readCapable: boolean;
  syncVerified: boolean;
  businessGraphIngestion: boolean;
  aiDiscovery: boolean;
  mcpExposed: boolean;
  writeCapable: boolean;
  approvalRequired: boolean;
  idempotencySupported: boolean;
  verificationMethod: string;
  webhookSupported: boolean;
  refreshSupported: boolean;
  disconnectSupported: boolean;
  mobileResponsive: boolean;
  status: ConnectorCertificationStatus;
  ownerAction: string;
}

export interface OwnerSetupMatrixEntry {
  providerId: string;
  providerName: string;
  category: string;
  authType: string;
  developerPortalUrl: string;
  canonicalCallbackUrl: string;
  requiredScopes: string[];
  requiredEnvVars: string[];
  vaultSecretKey: string;
  identityVerificationEndpoint: string;
  readVerificationEndpoints: string[];
  setupGuide: string[];
}

export const CONNECTOR_REALITY_MATRIX: RealityMatrixEntry[] = CONNECTOR_REALITY_MATRIX_57;
export const OWNER_SETUP_MATRIX: OwnerSetupMatrixEntry[] = OWNER_SETUP_MATRIX_57;

/**
 * Returns dynamic, strictly truthful certification matrix for a specific tenant.
 * Zero Fake Connectors Rule:
 * - If not in tenant.connectors -> AUTH_READY (if env configured) or IMPLEMENTED_UNCONFIGURED.
 * - Only instances that are authenticated and healthy with real provenance can be SYNC_VERIFIED.
 */
export function getTenantRealityMatrix(tenantConnectors: any[] = []): RealityMatrixEntry[] {
  const connMap = new Map<string, any>();
  tenantConnectors.forEach(c => connMap.set(c.providerId, c));

  // Explicit Platform Infrastructure classification list
  // Note: resend, google_maps, and stripe platform subscription billing are Platform Infrastructure.
  // Customer Stripe Connect for tenant business payments is a separate tenant business connector.
  const platformInfraIds = new Set(['resend', 'google_maps']);

  return CONNECTOR_REALITY_MATRIX_57.map(entry => {
    // If provider is stripe, check if it's tenant business Connect vs platform billing
    const isStripe = entry.providerId === 'stripe';
    const isPlatformInfra = platformInfraIds.has(entry.providerId);
    
    const connectorType: ConnectorClassificationType = isPlatformInfra 
      ? 'PLATFORM_INFRASTRUCTURE' 
      : 'TENANT_BUSINESS_CONNECTOR';

    const active = connMap.get(entry.providerId);
    if (!active) {
      const isConfigured = isStripe ? false : entry.credentialsConfigured; // Stripe Connect requires customer oauth onboarding, not platform secret
      return {
        ...entry,
        connectorType,
        identityVerified: false,
        syncVerified: false,
        status: isConfigured ? ('AUTH_READY' as const) : ('IMPLEMENTED_UNCONFIGURED' as const),
        ownerAction: isStripe
          ? 'Customer Stripe Connect: NOT ACTIVATED (Requires Tenant Stripe Connect Onboarding Client ID; platform billing secret is strictly isolated for SignalDesk subscription revenue).'
          : isPlatformInfra
          ? `Platform infrastructure service: ${entry.providerName} (${entry.credentialsConfigured ? 'System Configured' : 'Awaiting Config'}).`
          : entry.credentialsConfigured 
          ? `Credentials configured. Ready to connect ${entry.providerName}.`
          : entry.ownerAction
      };
    }

    const isHealthy = active.status === 'healthy';
    return {
      ...entry,
      connectorType,
      identityVerified: Boolean(active.authenticatedPrincipal),
      syncVerified: Boolean(active.lastSuccessfulSync),
      status: (isHealthy && active.lastSuccessfulSync) 
        ? ('SYNC_VERIFIED' as const) 
        : active.status === 'error' 
        ? ('DEGRADED' as const)
        : ('AUTH_READY' as const),
      ownerAction: isHealthy ? 'Connected & Verified.' : 'Requires Attention.'
    };
  });
}
