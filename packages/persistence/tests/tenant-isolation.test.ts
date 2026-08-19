import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { withTenantContext } from "../src/tenant-context";
import {
  getTestPool,
  queryWithoutTenantContext,
  seedOrganization,
} from "./support";

// These tests exercise the forced RLS policies in
// drizzle/0001_tenant_rls_policies.sql and drizzle/0003_harden_tenant_provenance.sql
// against a real Postgres instance, connected as the least-privilege
// app_runtime role (never the migration owner). There is no DELETE grant for
// this role by design, so seeded rows are not cleaned up between runs; this
// dev project is disposable rather than reset between test runs.
//
// Requires DATABASE_URL (the app_runtime connection string); skipped rather
// than failed when it is absent so `pnpm check`/CI stay green without a
// provisioned database secret wired in yet.
describe.skipIf(!process.env.DATABASE_URL)(
  "tenant isolation (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    describe("cross-tenant isolation", () => {
      it("cannot select another organization's row", async () => {
        const orgA = await seedOrganization(pool);
        const orgB = await seedOrganization(pool);

        const rows = await withTenantContext(pool, orgA.id, async (client) => {
          const result = await client.query(
            "select id from organizations where id = $1",
            [orgB.id],
          );
          return result.rows;
        });

        expect(rows).toHaveLength(0);
      });

      it("cannot update another organization's row", async () => {
        const orgA = await seedOrganization(pool);
        const orgB = await seedOrganization(pool);

        const affectedRows = await withTenantContext(
          pool,
          orgA.id,
          async (client) => {
            const result = await client.query(
              "update organizations set display_name = 'hijacked' where id = $1",
              [orgB.id],
            );
            return result.rowCount;
          },
        );

        expect(affectedRows).toBe(0);

        const stillOriginal = await withTenantContext(
          pool,
          orgB.id,
          async (client) => {
            const result = await client.query(
              "select display_name from organizations where id = $1",
              [orgB.id],
            );
            return result.rows[0]?.display_name;
          },
        );

        expect(stillOriginal).toBe(orgB.slug);
      });

      it("cannot insert a row claiming a different organization's id while in another tenant's context", async () => {
        const orgA = await seedOrganization(pool);
        const foreignId = randomUUID();

        await expect(
          withTenantContext(pool, orgA.id, async (client) => {
            await client.query(
              "insert into organizations (id, slug, display_name) values ($1, $2, $2)",
              [foreignId, `smuggled-${foreignId}`],
            );
          }),
        ).rejects.toThrow(/row-level security/i);
      });

      it("scopes memberships to the current tenant even though users are a global table", async () => {
        const orgA = await seedOrganization(pool);
        const orgB = await seedOrganization(pool);

        const rows = await withTenantContext(pool, orgA.id, async (client) => {
          const result = await client.query(
            "select id from memberships where organization_id = $1",
            [orgB.id],
          );
          return result.rows;
        });

        expect(rows).toHaveLength(0);
      });
    });

    describe("fail-closed access", () => {
      it("returns zero rows when no tenant context has been set on the connection", async () => {
        const org = await seedOrganization(pool);

        const result = await queryWithoutTenantContext(
          pool,
          "select id from organizations where id = $1",
          [org.id],
        );

        expect(result.rows).toHaveLength(0);
      });

      it("cannot insert without a tenant context set (app.current_organization_id is null)", async () => {
        const id = randomUUID();

        await expect(
          queryWithoutTenantContext(
            pool,
            "insert into organizations (id, slug, display_name) values ($1, $2, $2)",
            [id, `no-context-${id}`],
          ),
        ).rejects.toThrow(/row-level security/i);
      });
    });

    describe("pooled-connection isolation", () => {
      it("does not leak tenant context between sequential transactions on the same pool", async () => {
        const orgA = await seedOrganization(pool);
        const orgB = await seedOrganization(pool);

        // First transaction: context is org A.
        const seenFromA = await withTenantContext(
          pool,
          orgA.id,
          async (client) => {
            const result = await client.query(
              "select id from organizations where id = $1",
              [orgB.id],
            );
            return result.rows.length;
          },
        );
        expect(seenFromA).toBe(0);

        // Second transaction on the same pool, different tenant: must not see
        // org A's leaked setting from a reused underlying connection.
        const seenFromB = await withTenantContext(
          pool,
          orgB.id,
          async (client) => {
            const result = await client.query(
              "select id from organizations where id = $1",
              [orgA.id],
            );
            return result.rows.length;
          },
        );
        expect(seenFromB).toBe(0);

        // And a fresh transaction with no context set at all must also see
        // none, proving set_config(..., true) reset when the prior
        // transactions committed.
        const seenWithoutContext = await queryWithoutTenantContext(
          pool,
          "select id from organizations where id in ($1, $2)",
          [orgA.id, orgB.id],
        );
        expect(seenWithoutContext.rows).toHaveLength(0);
      });

      it("rolls back the tenant-context transaction (and its effects) when fn throws", async () => {
        const orgA = await seedOrganization(pool);

        await expect(
          withTenantContext(pool, orgA.id, async (client) => {
            await client.query(
              "update organizations set display_name = 'should-not-stick' where id = $1",
              [orgA.id],
            );
            throw new Error("boom");
          }),
        ).rejects.toThrow("boom");

        const displayName = await withTenantContext(
          pool,
          orgA.id,
          async (client) => {
            const result = await client.query(
              "select display_name from organizations where id = $1",
              [orgA.id],
            );
            return result.rows[0]?.display_name;
          },
        );

        expect(displayName).toBe(orgA.slug);
      });
    });
  },
);
