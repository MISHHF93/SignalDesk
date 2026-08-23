import { randomUUID, createHash } from "node:crypto";

import type { PoolClient } from "pg";

import { createDatabasePool, type DatabasePool } from "../src/client";
import { provisionIdentityAndOrganization } from "../src/identity";
import { startSyncJob, type SyncJobEntityType } from "../src/sync-jobs";
import { withTenantContext } from "../src/tenant-context";

export function getTestPool(): DatabasePool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must point at the app_runtime role on a real Postgres instance to run persistence integration tests.",
    );
  }

  return createDatabasePool();
}

export async function seedOrganization(
  pool: DatabasePool,
  overrides: { id?: string; slug?: string; displayName?: string } = {},
): Promise<{ id: string; slug: string }> {
  const id = overrides.id ?? randomUUID();
  const slug = overrides.slug ?? `org-${randomUUID()}`;
  const displayName = overrides.displayName ?? slug;

  await withTenantContext(pool, id, async (client) => {
    await client.query(
      `insert into organizations (id, slug, display_name) values ($1, $2, $3)`,
      [id, slug, displayName],
    );
  });

  return { id, slug };
}

export async function seedIntegration(
  pool: DatabasePool,
  organizationId: string,
  overrides: { sourceSystem?: string; externalAccountId?: string } = {},
): Promise<{ id: string; sourceSystem: string }> {
  const id = randomUUID();
  const sourceSystem = overrides.sourceSystem ?? "hubspot";
  const externalAccountId =
    overrides.externalAccountId ?? `account-${randomUUID()}`;

  await withTenantContext(pool, organizationId, async (client) => {
    await client.query(
      `insert into integrations (id, organization_id, source_system, external_account_id)
       values ($1, $2, $3, $4)`,
      [id, organizationId, sourceSystem, externalAccountId],
    );
  });

  return { id, sourceSystem };
}

export async function seedSourceRecord(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  sourceSystem: string,
  overrides: { idempotencyKey?: string; externalRecordId?: string } = {},
): Promise<{ id: string; idempotencyKey: string }> {
  const id = randomUUID();
  const idempotencyKey = overrides.idempotencyKey ?? `idem-${randomUUID()}`;
  const externalRecordId =
    overrides.externalRecordId ?? `external-${randomUUID()}`;
  const payloadSha256 = createHash("sha256").update(id).digest("hex");

  await withTenantContext(pool, organizationId, async (client) => {
    await client.query(
      `insert into source_records (
         id, organization_id, integration_id, source_system, source_object_type,
         external_record_id, source_version, source_schema_version,
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length
       ) values ($1, $2, $3, $4, 'lead', $5, 'v1', 1, $6, now(), $7, 0)`,
      [
        id,
        organizationId,
        integrationId,
        sourceSystem,
        externalRecordId,
        idempotencyKey,
        payloadSha256,
      ],
    );
  });

  return { id, idempotencyKey };
}

/**
 * Starts a real `sync_jobs` row for tests that need a real `syncJobId` to
 * pass to an ingest function (`ingestQuickBooksInvoice`/`ingestHubSpotDeal`/
 * `ingestAsanaTask`/`ingestQuickBooksPayment`) now that `source_records`
 * really foreign-keys to it (ADR 0029) — a random UUID would fail the FK.
 */
export async function seedSyncJob(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  sourceSystem: string,
  entityType: SyncJobEntityType = "lead",
): Promise<{ id: string }> {
  const job = await startSyncJob(
    pool,
    organizationId,
    integrationId,
    sourceSystem,
    entityType,
    "manual",
    null,
  );

  return { id: job.id };
}

/**
 * Provisions a real organization, user, and owner membership together —
 * the only sanctioned way to create a real member (`users` has no ordinary
 * INSERT policy for `app_runtime`; see `identity.ts`). Use this instead of
 * `seedOrganization` whenever a test needs a real `userId`/membership to
 * pass to a function like `createInternalTask`.
 */
export async function seedMembership(
  pool: DatabasePool,
): Promise<{ organizationId: string; userId: string }> {
  return provisionIdentityAndOrganization(pool, {
    identityProvider: "test",
    identityProviderSubject: `subject-${randomUUID()}`,
    displayName: `Test User ${randomUUID()}`,
    primaryEmail: `test-${randomUUID()}@example.com`,
  });
}

export async function queryWithoutTenantContext(
  pool: DatabasePool,
  sql: string,
  params: unknown[] = [],
) {
  return pool.query(sql, params);
}

export type { PoolClient };
