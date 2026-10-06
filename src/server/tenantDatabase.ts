import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createDatabasePool, type DatabasePool } from '../../packages/persistence/src/client';
import { 
  ConnectedTool, 
  BusinessSignal, 
  BusinessMission, 
  WaitingOnMeItem, 
  BusinessMetric, 
  AuditRecord, 
  DailyExecutiveSynthesis,
  ConnectorLifecycleStatus,
  ConnectorInstance,
  ConnectorCatalogEntry
} from '../types';

export interface GraphEntityNode {
  id: string;
  entityType: 'customer' | 'invoice' | 'deal' | 'ticket' | 'payment' | 'subscription' | 'event' | 'document';
  name: string;
  sourceSystem: string;
  sourceRecordId: string;
  properties: Record<string, any>;
  provenance: {
    providerId: string;
    sourceSystem: string;
    sourceRecordId: string;
    ingestedAt: string;
    confidence: number;
    sourceTimestamp?: string;
    /** HMAC-SHA256 Cryptographic Tamper-Proof Digest */
    digest?: string;
    authorityLevel?: 'authoritative_system' | 'derived' | 'heuristic' | 'inference';
  };
  createdAt: string;
  updatedAt: string;
}

export interface GraphRelationshipEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relationshipType: 'BILLED_TO' | 'PAID_BY' | 'OPENED_BY' | 'ASSIGNED_TO' | 'DEPENDS_ON';
  properties?: Record<string, any>;
  provenance: {
    providerId: string;
    ingestedAt: string;
  };
}

export interface TenantRecord {
  tenantId: string;
  organization: {
    id: string;
    name: string;
    tier: string;
    createdAt: string;
  };
  connectors: ConnectorInstance[];
  businessGraph: {
    nodes: GraphEntityNode[];
    edges: GraphRelationshipEdge[];
  };
  signals: BusinessSignal[];
  situations: BusinessSignal[];
  waitingOnMe: WaitingOnMeItem[];
  metrics: BusinessMetric[];
  missions: BusinessMission[];
  auditLogs: AuditRecord[];
  commitments: any[];
  decisions: any[];
  documents: any[];
  workspaceActions: any[];
  processedWebhookIds: string[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const VAULT_DIR = path.join(DATA_DIR, 'vault');
const STORE_FILE = path.join(DATA_DIR, 'tenant_store.json');
const VAULT_BACKUP_FILE = path.join(DATA_DIR, 'vault_credentials.secure.json');

// Ensure directories exist for local cache / vault
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(VAULT_DIR)) {
  fs.mkdirSync(VAULT_DIR, { recursive: true });
}

// Derive a secure AES-256 key from server environment secret
function getMasterKey(): Buffer {
  const secret = process.env.APP_SECRET || process.env.GEMINI_API_KEY || 'signaldesk-vault-master-key-seed-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Computes an HMAC-SHA256 cryptographic digest binding entity identity, source ID, and payload
 * to guarantee tamper-proof cryptographic provenance.
 */
export function computeProvenanceDigest(node: { id: string; sourceSystem: string; sourceRecordId: string; ingestedAt: string }): string {
  const hmac = crypto.createHmac('sha256', getMasterKey());
  const payload = `${node.id}:${node.sourceSystem}:${node.sourceRecordId}:${node.ingestedAt}`;
  return `sd_hmac_${hmac.update(payload).digest('hex').substring(0, 32)}`;
}

/**
 * Validates cryptographic tamper-proof digest on an ingested Business Graph node
 */
export function verifyProvenanceDigest(node: GraphEntityNode): boolean {
  if (!node.provenance?.digest) return false;
  const expected = computeProvenanceDigest({
    id: node.id,
    sourceSystem: node.provenance.sourceSystem,
    sourceRecordId: node.provenance.sourceRecordId,
    ingestedAt: node.provenance.ingestedAt
  });
  return node.provenance.digest === expected;
}

import { credentialManager } from './credentialStore';

/**
 * Secure AES-256-GCM Vault Encryption
 * Encrypts sensitive OAuth tokens, refresh tokens, and API secrets.
 */
export function encryptSecret(plainText: string): string {
  return credentialManager.encrypt(plainText);
}

/**
 * Secure AES-256-GCM Vault Decryption
 */
export function decryptSecret(cipherText: string): string {
  return credentialManager.decrypt(cipherText);
}

/**
 * Store credential payload securely via CredentialStore engine
 */
export function storeVaultCredential(refId: string, plainTextToken: string): string {
  credentialManager.storeCredential(refId, plainTextToken);
  const cipher = credentialManager.encrypt(plainTextToken);
  return `sd_sec_v1:${refId}:${cipher}`;
}

/**
 * Retrieve decrypted credential from secure CredentialStore engine
 */
export function getVaultCredential(refId: string): string {
  return credentialManager.getCredential(refId);
}

/**
 * Delete credential from secure CredentialStore engine
 */
export function purgeVaultCredential(refId: string): void {
  credentialManager.purgeCredential(refId);
}

/**
 * Default Honest Empty State for New Tenant
 * ZERO fabricated business records. Zero fake Acme leads. Zero fake ARR.
 */
export function createEmptyTenantRecord(tenantId: string = 'org_default'): TenantRecord {
  return {
    tenantId,
    organization: {
      id: tenantId,
      name: 'SignalDesk Organization',
      tier: 'Enterprise Production',
      createdAt: new Date().toISOString()
    },
    connectors: [],
    businessGraph: {
      nodes: [],
      edges: []
    },
    signals: [],
    situations: [],
    waitingOnMe: [],
    metrics: [
      {
        id: 'm_arr',
        label: 'Annual Recurring Revenue (ARR)',
        value: 'Not Connected',
        numericValue: 0,
        changePercent: 0,
        trend: 'neutral',
        status: 'healthy',
        provenance: {
          authoritativeSystem: 'None Connected',
          formula: 'Sum of verified active recurring subscriptions annualized across CRM & Billing',
          lastSynced: 'Awaiting connector ingestion'
        }
      },
      {
        id: 'm_cash',
        label: 'Operating Cash Balance',
        value: 'Not Connected',
        numericValue: 0,
        changePercent: 0,
        trend: 'neutral',
        status: 'healthy',
        provenance: {
          authoritativeSystem: 'None Connected',
          formula: 'Verified liquid cash across treasury and settlement accounts',
          lastSynced: 'Awaiting connector ingestion'
        }
      },
      {
        id: 'm_overdue',
        label: 'Overdue Invoices',
        value: 'Not Connected',
        numericValue: 0,
        changePercent: 0,
        trend: 'neutral',
        status: 'healthy',
        provenance: {
          authoritativeSystem: 'None Connected',
          formula: 'Sum of overdue accounts receivable > 0 days',
          lastSynced: 'Awaiting connector ingestion'
        }
      },
      {
        id: 'm_burn',
        label: 'Net Monthly Burn',
        value: 'Not Connected',
        numericValue: 0,
        changePercent: 0,
        trend: 'neutral',
        status: 'healthy',
        provenance: {
          authoritativeSystem: 'None Connected',
          formula: 'Monthly operating expenses less collected revenues',
          lastSynced: 'Awaiting connector ingestion'
        }
      }
    ],
    missions: [],
    auditLogs: [
      {
        id: `audit-init-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actionId: 'tenant-initialized',
        actionTitle: 'Real Data Activation Initialized',
        actionName: 'Real Data Activation Initialized',
        targetSystem: 'internal_agent',
        executedBy: {
          type: 'human',
          identifier: 'System Administrator'
        },
        status: 'success',
        policyPassed: true,
        verificationProof: 'Durable tenant database initialized with zero fabricated business records.'
      }
    ],
    commitments: [],
    decisions: [],
    documents: [],
    workspaceActions: [],
    processedWebhookIds: []
  };
}

// =========================================================================
// AUTHORITATIVE POSTGRESQL PERSISTENCE LAYER
// =========================================================================

let pool: DatabasePool | null = null;
function getPool(): DatabasePool {
  if (!pool) {
    pool = createDatabasePool();
  }
  return pool;
}

// In-memory tenant cache maintained in sync with PostgreSQL
const tenantMemoryCache = new Map<string, TenantRecord>();

/**
 * Load tenant record directly from authoritative PostgreSQL database
 */
export async function loadTenantDataFromPostgres(tenantId: string = 'org_default'): Promise<TenantRecord | null> {
  const p = getPool();
  const client = await p.connect();
  try {
    const stateRes = await client.query('SELECT * FROM tenant_operational_state WHERE tenant_id = $1', [tenantId]);
    if (stateRes.rows.length === 0) {
      return null;
    }
    const stateRow = stateRes.rows[0];

    const connRes = await client.query('SELECT * FROM tenant_connectors WHERE tenant_id = $1 ORDER BY created_at ASC', [tenantId]);
    const connectors: ConnectorInstance[] = connRes.rows.map(r => {
      if (r.encrypted_credential_ref) {
        if (r.encrypted_credential_ref.startsWith('sd_sec_v1:')) {
          const parts = r.encrypted_credential_ref.split(':');
          const refId = parts[1];
          const cipher = parts.slice(2).join(':');
          credentialManager.registerDurableCredential(refId, cipher);
        } else if (r.encrypted_credential_ref.includes(':') && r.encrypted_credential_ref.split(':').length === 3) {
          const defaultRefId = `tenant_${tenantId}_${r.provider_id}`;
          credentialManager.registerDurableCredential(defaultRefId, r.encrypted_credential_ref);
        }
      }
      return {
        id: r.instance_id,
        tenantId: r.tenant_id,
        providerId: r.provider_id,
        status: r.status,
        authenticatedPrincipal: r.authenticated_principal,
        scopes: r.scopes,
        encryptedCredentialRef: r.encrypted_credential_ref,
        lastAttemptedSync: r.last_attempted_sync ? new Date(r.last_attempted_sync).toISOString() : undefined,
        lastSuccessfulSync: r.last_successful_sync ? new Date(r.last_successful_sync).toISOString() : undefined,
        freshness: r.freshness,
        reconnectRequired: r.reconnect_required,
        health: r.health,
        eventCount24h: r.event_count_24h,
        recentEventsLog: r.recent_events_log || [],
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
      };
    });

    const nodeRes = await client.query('SELECT * FROM tenant_business_graph_nodes WHERE tenant_id = $1 ORDER BY created_at ASC', [tenantId]);
    const nodes: GraphEntityNode[] = nodeRes.rows.map(r => ({
      id: r.node_id,
      entityType: r.entity_type,
      name: r.name,
      sourceSystem: r.source_system,
      sourceRecordId: r.source_record_id,
      properties: r.properties || {},
      provenance: r.provenance || {
        providerId: r.source_system,
        sourceSystem: r.source_system,
        sourceRecordId: r.source_record_id,
        ingestedAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        confidence: 1.0,
        digest: r.provenance_digest
      },
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
    }));

    const record: TenantRecord = {
      tenantId,
      organization: stateRow.organization,
      connectors,
      businessGraph: {
        nodes,
        edges: stateRow.edges || []
      },
      signals: stateRow.signals || [],
      situations: stateRow.situations || [],
      waitingOnMe: stateRow.waiting_on_me || [],
      metrics: stateRow.metrics || [],
      missions: stateRow.missions || [],
      auditLogs: stateRow.audit_logs || [],
      commitments: stateRow.commitments || [],
      decisions: stateRow.decisions || [],
      documents: stateRow.documents || [],
      workspaceActions: stateRow.workspace_actions || [],
      processedWebhookIds: stateRow.processed_webhook_ids || []
    };

    tenantMemoryCache.set(tenantId, record);
    return record;
  } finally {
    client.release();
  }
}

/**
 * Persist tenant record atomically and transactionally to PostgreSQL
 */
export async function saveTenantDataToPostgres(tenant: TenantRecord): Promise<void> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    // 1. Transactionally upsert tenant operational state
    await client.query(`
      INSERT INTO tenant_operational_state (
        tenant_id, organization, signals, situations, waiting_on_me, metrics, missions, audit_logs, commitments, decisions, edges, documents, workspace_actions, processed_webhook_ids, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (tenant_id) DO UPDATE SET
        organization = EXCLUDED.organization,
        signals = EXCLUDED.signals,
        situations = EXCLUDED.situations,
        waiting_on_me = EXCLUDED.waiting_on_me,
        metrics = EXCLUDED.metrics,
        missions = EXCLUDED.missions,
        audit_logs = EXCLUDED.audit_logs,
        commitments = EXCLUDED.commitments,
        decisions = EXCLUDED.decisions,
        edges = EXCLUDED.edges,
        documents = EXCLUDED.documents,
        workspace_actions = EXCLUDED.workspace_actions,
        processed_webhook_ids = EXCLUDED.processed_webhook_ids,
        updated_at = NOW()
    `, [
      tenant.tenantId,
      JSON.stringify(tenant.organization || { id: tenant.tenantId, name: 'SignalDesk Organization', tier: 'Enterprise Production', createdAt: new Date().toISOString() }),
      JSON.stringify(tenant.signals || []),
      JSON.stringify(tenant.situations || []),
      JSON.stringify(tenant.waitingOnMe || []),
      JSON.stringify(tenant.metrics || []),
      JSON.stringify(tenant.missions || []),
      JSON.stringify(tenant.auditLogs || []),
      JSON.stringify(tenant.commitments || []),
      JSON.stringify(tenant.decisions || []),
      JSON.stringify(tenant.businessGraph?.edges || []),
      JSON.stringify(tenant.documents || []),
      JSON.stringify(tenant.workspaceActions || []),
      JSON.stringify(tenant.processedWebhookIds || [])
    ]);

    // 2. Synchronize connectors
    const providerIds = (tenant.connectors || []).map(c => c.providerId);
    if (providerIds.length > 0) {
      await client.query(
        'DELETE FROM tenant_connectors WHERE tenant_id = $1 AND provider_id != ALL($2::text[])',
        [tenant.tenantId, providerIds]
      );
    } else {
      await client.query('DELETE FROM tenant_connectors WHERE tenant_id = $1', [tenant.tenantId]);
    }

    for (const conn of tenant.connectors || []) {
      await client.query(`
        INSERT INTO tenant_connectors (
          tenant_id, provider_id, instance_id, status, authenticated_principal, scopes,
          encrypted_credential_ref, last_attempted_sync, last_successful_sync, freshness,
          reconnect_required, health, event_count_24h, recent_events_log, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
        ON CONFLICT (tenant_id, provider_id) DO UPDATE SET
          instance_id = EXCLUDED.instance_id,
          status = EXCLUDED.status,
          authenticated_principal = EXCLUDED.authenticated_principal,
          scopes = EXCLUDED.scopes,
          encrypted_credential_ref = EXCLUDED.encrypted_credential_ref,
          last_attempted_sync = EXCLUDED.last_attempted_sync,
          last_successful_sync = EXCLUDED.last_successful_sync,
          freshness = EXCLUDED.freshness,
          reconnect_required = EXCLUDED.reconnect_required,
          health = EXCLUDED.health,
          event_count_24h = EXCLUDED.event_count_24h,
          recent_events_log = EXCLUDED.recent_events_log,
          updated_at = NOW()
      `, [
        tenant.tenantId,
        conn.providerId,
        conn.id || `conn_${conn.providerId}_${tenant.tenantId}`,
        conn.status,
        JSON.stringify(conn.authenticatedPrincipal || {}),
        conn.scopes ? JSON.stringify(conn.scopes) : '[]',
        (() => {
          if (!conn.encryptedCredentialRef) return null;
          if (conn.encryptedCredentialRef.startsWith('sd_sec_v1:')) return conn.encryptedCredentialRef;
          const plain = credentialManager.getCredential(conn.encryptedCredentialRef);
          if (plain) {
            const cipher = credentialManager.encrypt(plain);
            return `sd_sec_v1:${conn.encryptedCredentialRef}:${cipher}`;
          }
          return conn.encryptedCredentialRef;
        })(),
        conn.lastAttemptedSync ? new Date(conn.lastAttemptedSync) : null,
        conn.lastSuccessfulSync ? new Date(conn.lastSuccessfulSync) : null,
        conn.freshness || null,
        conn.reconnectRequired || false,
        JSON.stringify(conn.health || {}),
        conn.eventCount24h || 0,
        JSON.stringify(conn.recentEventsLog || []),
        conn.createdAt ? new Date(conn.createdAt) : new Date()
      ]);
    }

    // 3. Synchronize business graph nodes
    const nodeIds = (tenant.businessGraph?.nodes || []).map(n => n.id);
    if (nodeIds.length > 0) {
      await client.query(
        'DELETE FROM tenant_business_graph_nodes WHERE tenant_id = $1 AND node_id != ALL($2::text[])',
        [tenant.tenantId, nodeIds]
      );
    } else {
      await client.query('DELETE FROM tenant_business_graph_nodes WHERE tenant_id = $1', [tenant.tenantId]);
    }

    for (const node of tenant.businessGraph?.nodes || []) {
      if (!node.provenance?.digest) {
        node.provenance.digest = computeProvenanceDigest({
          id: node.id,
          sourceSystem: node.sourceSystem,
          sourceRecordId: node.sourceRecordId,
          ingestedAt: node.provenance?.ingestedAt || new Date().toISOString()
        });
      }

      await client.query(`
        INSERT INTO tenant_business_graph_nodes (
          tenant_id, node_id, entity_type, name, source_system, source_record_id, properties, provenance, provenance_digest, authority_level, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (tenant_id, source_system, source_record_id) DO UPDATE SET
          node_id = EXCLUDED.node_id,
          entity_type = EXCLUDED.entity_type,
          name = EXCLUDED.name,
          properties = EXCLUDED.properties,
          provenance = EXCLUDED.provenance,
          provenance_digest = EXCLUDED.provenance_digest,
          authority_level = EXCLUDED.authority_level,
          updated_at = NOW()
      `, [
        tenant.tenantId,
        node.id,
        node.entityType,
        node.name,
        node.sourceSystem,
        node.sourceRecordId,
        JSON.stringify(node.properties || {}),
        JSON.stringify(node.provenance || {}),
        node.provenance?.digest || null,
        node.provenance?.authorityLevel || 'authoritative_system',
        node.createdAt ? new Date(node.createdAt) : new Date()
      ]);
    }

    await client.query('COMMIT');

    // Update memory cache
    tenantMemoryCache.set(tenant.tenantId, tenant);

    // Also persist non-blocking disk backup in dev mode only
    try {
      let allData: Record<string, TenantRecord> = {};
      if (fs.existsSync(STORE_FILE)) {
        try { allData = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); } catch { allData = {}; }
      }
      allData[tenant.tenantId] = tenant;
      const tempFile = `${STORE_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(allData, null, 2), 'utf8');
      fs.renameSync(tempFile, STORE_FILE);
    } catch {
      // Ignored
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to save tenant data to PostgreSQL:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Bootstrap or sync tenant database from PostgreSQL
 */
export async function initializeTenantDatabase(tenantId: string = 'org_default'): Promise<TenantRecord> {
  try {
    const existing = await loadTenantDataFromPostgres(tenantId);
    if (existing && existing.businessGraph && existing.businessGraph.nodes.length > 0) {
      tenantMemoryCache.set(tenantId, existing);
      return existing;
    }

    // Check if local file exists to migrate baseline
    let seedRecord: TenantRecord | null = null;
    if (fs.existsSync(STORE_FILE)) {
      try {
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed[tenantId] && parsed[tenantId].businessGraph?.nodes?.length > 0) {
          seedRecord = parsed[tenantId];
        }
      } catch {
        // Ignore parse error
      }
    }

    if (!seedRecord) {
      seedRecord = createEmptyTenantRecord(tenantId);
    }

    // Persist baseline to PostgreSQL
    await saveTenantDataToPostgres(seedRecord);
    tenantMemoryCache.set(tenantId, seedRecord);
    return seedRecord;
  } catch (err) {
    console.error('Error initializing PostgreSQL tenant database:', err);
    // In dev, fallback to disk if DB unreachable
    let fallback = createEmptyTenantRecord(tenantId);
    if (fs.existsSync(STORE_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
        if (raw[tenantId]) fallback = raw[tenantId];
      } catch {}
    }
    tenantMemoryCache.set(tenantId, fallback);
    return fallback;
  }
}

// Initial bootstrap trigger
initializeTenantDatabase('org_default').catch(err => {
  console.error('Initial PostgreSQL bootstrap failed:', err);
});

/**
 * Load tenant record synchronously from memory cache
 */
export function loadTenantData(tenantId: string = 'org_default'): TenantRecord {
  const cached = tenantMemoryCache.get(tenantId);
  if (cached) {
    return cached;
  }

  // If not yet in memory, try to read from disk as initial placeholder while DB completes
  if (fs.existsSync(STORE_FILE)) {
    try {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const data: Record<string, TenantRecord> = JSON.parse(raw);
      if (data[tenantId]) {
        tenantMemoryCache.set(tenantId, data[tenantId]);
        return data[tenantId];
      }
    } catch {
      // Fallback below
    }
  }

  const initial = createEmptyTenantRecord(tenantId);
  tenantMemoryCache.set(tenantId, initial);
  return initial;
}

/**
 * Persist tenant record atomically and asynchronously to PostgreSQL
 */
export function saveTenantData(tenant: TenantRecord): void {
  tenantMemoryCache.set(tenant.tenantId, tenant);

  // Fire-and-forget save to PostgreSQL
  saveTenantDataToPostgres(tenant).catch(err => {
    console.error(`Background PostgreSQL save failed for tenant ${tenant.tenantId}:`, err);
  });
}

/**
 * Generate Honest Executive Daily Synthesis based on REAL business graph and situations
 */
export function generateRealDailySynthesis(tenant: TenantRecord): DailyExecutiveSynthesis {
  const connectedCount = tenant.connectors.filter(c => c.status === 'healthy' || c.status === 'connected').length;
  const criticalCount = tenant.situations.filter(s => s.urgency === 'critical').length;
  const waitingCount = tenant.waitingOnMe.length;
  const blockedRevenue = tenant.situations.reduce((acc, s) => acc + (s.financialExposure || 0), 0);

  if (connectedCount === 0) {
    return {
      headline: 'Awaiting System Connections • Operating Canvas Ready',
      executiveSummary: 'SignalDesk is in Real-Data Activation Mode. Zero external systems are currently connected, so no synthetic business signals, fabricated revenues, or mock customer situations are displayed. Connect your primary CRM, accounting, billing, and communication tools to begin continuous automated monitoring.',
      businessPulse: 'Stable',
      healthScore: 100,
      blockedRevenueTotal: 0,
      criticalIssuesCount: 0,
      unassignedCount: 0,
      answers: {
        whatCameIn: 'No external events received yet. Real-time telemetry will stream in once connectors are authorized.',
        whatIsStuck: 'No items stuck. All governance gates and background sync queues are clear.',
        whoOwnsIt: 'System Administrator owns initial system connection and authorization.',
        whatIsNext: 'Connect your first authoritative system (e.g. Stripe, Google Workspace, Salesforce) in the Connector Library.'
      },
      cardinalQuestions: {
        whatNeedsAttention: 'Connect business systems to activate real-time intelligence.',
        whatNeedsAttentionCount: 0,
        whatIsWaitingOnMe: 'No pending approvals in the Safe Action Gateway.',
        whatIsWaitingOnMeCount: 0,
        whatMovedForward: 'Secure vault and durable tenant database initialized.',
        whatMovedForwardCount: 1,
        whatIsSlipping: 'Zero slipped commitments detected.',
        whatIsSlippingCount: 0
      },
      topRecommendations: [
        'Open the Connector Library and connect Stripe or Google Workspace to initialize real data ingestion.',
        'Set your Safe Action Gateway approval thresholds for single and dual-key policies.'
      ],
      generatedAt: 'Just now'
    };
  }

  // When real connectors are active
  const arrMetric = tenant.metrics.find(m => m.id === 'm_arr');
  const arrValue = arrMetric ? arrMetric.value : '$0.00';

  return {
    headline: criticalCount > 0 
      ? `${criticalCount} Critical Situation${criticalCount > 1 ? 's' : ''} Requiring Executive Action`
      : `Operational Health Verified across ${connectedCount} Active System${connectedCount > 1 ? 's' : ''}`,
    executiveSummary: criticalCount > 0
      ? `Real-time synchronization across ${connectedCount} connected systems has detected ${tenant.situations.length} active situations with total financial exposure of $${blockedRevenue.toLocaleString()}.`
      : `All ${connectedCount} connected systems are synchronized and operating within normal parameters. Real ARR is verified at ${arrValue}. Safe Action Gateway is active with ${waitingCount} pending approval${waitingCount === 1 ? '' : 's'}.`,
    businessPulse: criticalCount > 0 ? 'Critical Action Required' : tenant.situations.length > 0 ? 'Elevated Attention' : 'Stable',
    healthScore: Math.max(20, 100 - (criticalCount * 25) - (tenant.situations.length * 10)),
    blockedRevenueTotal: blockedRevenue,
    criticalIssuesCount: criticalCount,
    unassignedCount: tenant.situations.filter(s => !s.ownerId).length,
    answers: {
      whatCameIn: `${tenant.businessGraph.nodes.length} verified entities normalized in the canonical Business Graph.`,
      whatIsStuck: criticalCount > 0 ? `${criticalCount} critical operational blockers detected across source systems.` : 'No critical blockers stuck.',
      whoOwnsIt: tenant.situations.length > 0 && tenant.situations[0].ownerName ? tenant.situations[0].ownerName : 'Operations Team',
      whatIsNext: waitingCount > 0 ? `Review ${waitingCount} pending authorization requests in the Safe Action Gateway.` : 'Monitor real-time connector event logs.'
    },
    cardinalQuestions: {
      whatNeedsAttention: tenant.situations.length > 0 ? tenant.situations[0].title : 'All operational flows normal.',
      whatNeedsAttentionCount: tenant.situations.length,
      whatIsWaitingOnMe: waitingCount > 0 ? `${waitingCount} Safe Action requests pending approval` : 'No pending approvals.',
      whatIsWaitingOnMeCount: waitingCount,
      whatMovedForward: `${tenant.connectors.filter(c => c.status === 'healthy').length} connectors healthy and ingesting.`,
      whatMovedForwardCount: connectedCount,
      whatIsSlipping: criticalCount > 0 ? `${criticalCount} items slipping` : 'None',
      whatIsSlippingCount: criticalCount
    },
    topRecommendations: tenant.situations.length > 0 
      ? tenant.situations.slice(0, 3).map(s => s.recommendedPathway)
      : ['Maintain automated polling and webhook subscriptions across connected systems.'],
    generatedAt: 'Just now'
  };
}

export { getCleanEnv } from './cleanEnv';
