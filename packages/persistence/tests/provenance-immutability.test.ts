import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { withTenantContext } from "../src/tenant-context";
import {
  getTestPool,
  seedIntegration,
  seedOrganization,
  seedSourceRecord,
} from "./support";

// Exercises reject_immutable_column_update (drizzle/0003_harden_tenant_provenance.sql)
// and the append-only grants in packages/persistence/sql/provision_app_role.sql
// against a real Postgres instance as the app_runtime role.
//
// Requires DATABASE_URL (the app_runtime connection string); skipped rather
// than failed when it is absent so `pnpm check`/CI stay green without a
// provisioned database secret wired in yet.
describe.skipIf(!process.env.DATABASE_URL)(
  "provenance and immutability (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    describe("immutable-column trigger (tables with an UPDATE policy)", () => {
      // organizations has organizations_tenant_update, so an UPDATE actually
      // reaches reject_immutable_column_update instead of being filtered out
      // by RLS before the trigger runs.
      it("rejects changing an immutable column (slug)", async () => {
        const org = await seedOrganization(pool);

        await expect(
          withTenantContext(pool, org.id, async (client) => {
            await client.query(
              "update organizations set slug = $1 where id = $2",
              [`renamed-${randomUUID()}`, org.id],
            );
          }),
        ).rejects.toThrow(/immutable column/i);
      });

      it("allows changing a column that is not in the immutable set (display_name)", async () => {
        const org = await seedOrganization(pool);

        await withTenantContext(pool, org.id, async (client) => {
          await client.query(
            "update organizations set display_name = $1 where id = $2",
            ["Renamed Display Name", org.id],
          );
        });

        const displayName = await withTenantContext(
          pool,
          org.id,
          async (client) => {
            const result = await client.query(
              "select display_name from organizations where id = $1",
              [org.id],
            );
            return result.rows[0]?.display_name;
          },
        );

        expect(displayName).toBe("Renamed Display Name");
      });
    });

    describe("append-only tables (no UPDATE policy at all yet)", () => {
      // source_records currently has only source_records_tenant_select and
      // source_records_tenant_insert (see 0003_harden_tenant_provenance.sql):
      // with no UPDATE policy, RLS filters out every row before an UPDATE
      // statement can match anything, so the immutability trigger on this
      // table is defense-in-depth for a future audited retention procedure
      // rather than the thing actually blocking writes today. This asserts
      // today's real behavior: zero rows affected, not an error.
      it("cannot modify a source_record at all (RLS has no UPDATE policy for this table)", async () => {
        const org = await seedOrganization(pool);
        const integration = await seedIntegration(pool, org.id);
        const record = await seedSourceRecord(
          pool,
          org.id,
          integration.id,
          integration.sourceSystem,
        );

        const affectedRows = await withTenantContext(
          pool,
          org.id,
          async (client) => {
            const result = await client.query(
              "update source_records set raw_payload_sha256 = repeat('0', 64) where id = $1",
              [record.id],
            );
            return result.rowCount;
          },
        );

        expect(affectedRows).toBe(0);
      });
    });

    describe("audit_events append-only enforcement", () => {
      async function seedAuditEvent(organizationId: string) {
        const eventId = randomUUID();
        const digest = randomUUID().replace(/-/g, "").padEnd(64, "0");

        await withTenantContext(pool, organizationId, async (client) => {
          await client.query(
            `insert into audit_events (
             id, organization_id, actor_kind, event_type, event_schema_version,
             subject_type, subject_id, correlation_id, idempotency_key, outcome,
             payload_digest, event_digest, metadata, retention_class, retain_until, occurred_at
           ) values (
             $1, $2, 'system', 'test.recorded', 1, 'organization', $3, $4, $5, 'recorded',
             repeat('a', 64), $6, '{}'::jsonb, 'standard', now() + interval '1 year', now()
           )`,
            [
              eventId,
              organizationId,
              organizationId,
              `corr-${eventId}`,
              `idem-${eventId}`,
              digest,
            ],
          );
        });

        return eventId;
      }

      it("cannot update an audit event (no UPDATE grant on the table)", async () => {
        const org = await seedOrganization(pool);
        const eventId = await seedAuditEvent(org.id);

        await expect(
          withTenantContext(pool, org.id, async (client) => {
            await client.query(
              "update audit_events set outcome = 'denied' where id = $1",
              [eventId],
            );
          }),
        ).rejects.toThrow(/permission denied/i);
      });

      it("cannot delete an audit event (no DELETE grant on the table)", async () => {
        const org = await seedOrganization(pool);
        const eventId = await seedAuditEvent(org.id);

        await expect(
          withTenantContext(pool, org.id, async (client) => {
            await client.query("delete from audit_events where id = $1", [
              eventId,
            ]);
          }),
        ).rejects.toThrow(/permission denied/i);
      });
    });

    describe("idempotency", () => {
      it("rejects a duplicate (organization_id, idempotency_key) source_record insert", async () => {
        const org = await seedOrganization(pool);
        const integration = await seedIntegration(pool, org.id);
        const record = await seedSourceRecord(
          pool,
          org.id,
          integration.id,
          integration.sourceSystem,
        );

        await expect(
          seedSourceRecord(
            pool,
            org.id,
            integration.id,
            integration.sourceSystem,
            {
              idempotencyKey: record.idempotencyKey,
            },
          ),
        ).rejects.toThrow(/duplicate key value/i);
      });
    });
  },
);
