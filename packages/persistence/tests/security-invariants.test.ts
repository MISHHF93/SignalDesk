import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { getTestPool } from "./support";

/**
 * Converts a real finding from this session's own launch-readiness pass
 * into an enforced invariant, not just a one-time manual check. Supabase's
 * automated advisor flags `plans`/`plan_prices`/`plan_entitlements`/
 * `plan_addons`/`rate_limit_buckets` as "RLS disabled... fully exposed to
 * anon/authenticated" — a real, correct warning about the table shape in
 * isolation, but a false positive for this specific database: none of
 * these five tables has ever been granted to `anon`/`authenticated` at
 * all (verified directly via `has_table_privilege`, not assumed from the
 * advisor's own text), so PostgREST cannot reach them regardless of RLS.
 *
 * This is an intentional design choice (see each table's own migration —
 * 0022's billing tables, 0045's `rate_limit_buckets` — for why RLS was
 * skipped in favor of an explicit `revoke all ... from public, anon,
 * authenticated`), not an oversight to silently accept. The advisor will
 * keep flagging it every time it runs, and a future migration could
 * accidentally grant one of these roles access without anyone noticing
 * the regression — this test is what actually catches that, rather than
 * relying on a human re-reading the advisor output and remembering this
 * context every time.
 */
describe.skipIf(!process.env.DATABASE_URL)(
  "security invariant: anon/authenticated have zero access to internal tables without RLS (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    const nonRlsTables = [
      "plans",
      "plan_prices",
      "plan_entitlements",
      "plan_addons",
      "rate_limit_buckets",
    ] as const;
    const privileges = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;
    const roles = ["anon", "authenticated"] as const;

    it.each(
      nonRlsTables.flatMap((table) =>
        roles.flatMap((role) =>
          privileges.map((privilege) => [table, role, privilege] as const),
        ),
      ),
    )("%s: %s has no %s privilege", async (table, role, privilege) => {
      const result = await pool.query<{ has_privilege: boolean }>(
        `select has_table_privilege($1, $2, $3) as has_privilege`,
        [role, `public.${table}`, privilege],
      );

      expect(result.rows[0]?.has_privilege).toBe(false);
    });

    it("confirms RLS is genuinely disabled on all five (documenting the actual mechanism, not just its effect)", async () => {
      const result = await pool.query<{
        relname: string;
        relrowsecurity: boolean;
      }>(
        `select relname, relrowsecurity
         from pg_class
         where relnamespace = 'public'::regnamespace
           and relname = any($1)`,
        [nonRlsTables],
      );

      expect(result.rows).toHaveLength(nonRlsTables.length);
      for (const row of result.rows) {
        expect(row.relrowsecurity).toBe(false);
      }
    });
  },
);

/**
 * Converts this repo's second real occurrence of the same mistake into an
 * enforced invariant, the same way the block above did for the first one.
 * PostgreSQL grants EXECUTE on a new function to PUBLIC by default (unlike
 * tables, which default to no access) — Supabase's PostgREST layer turns
 * that into a public `/rest/v1/rpc/<function>` endpoint for any
 * `SECURITY DEFINER` function that doesn't explicitly revoke it, bypassing
 * this app's entire tenant-scoped RLS model regardless of what the
 * function's own SQL queries. Migration 0008 fixed this for the three
 * identity-provisioning functions from 0007; migrations 0055b and 0056
 * then repeated the exact same mistake for `list_active_organization_ids`
 * and `list_stripe_linked_subscriptions` (the latter leaking every
 * organization's Stripe customer id, subscription id, and live billing
 * status to an unauthenticated caller) — confirmed live via
 * `information_schema.role_routine_grants` before migration 0058 fixed it.
 *
 * Rather than hardcoding today's two function names (which would only
 * catch a regression on these specific functions), this discovers every
 * `SECURITY DEFINER` function in the public schema and asserts none of
 * them grant EXECUTE to `anon`/`authenticated` — so the *next* new
 * SECURITY DEFINER function this repo adds is covered automatically,
 * not just the ones already known about.
 */
describe.skipIf(!process.env.DATABASE_URL)(
  "security invariant: no SECURITY DEFINER function in public schema is anon/authenticated-executable (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("finds zero publicly-executable SECURITY DEFINER functions", async () => {
      const result = await pool.query<{
        proname: string;
        exposed_to: string;
      }>(
        `select p.proname,
                case
                  when has_function_privilege('anon', p.oid, 'EXECUTE')
                    then 'anon'
                  else 'authenticated'
                end as exposed_to
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.prosecdef = true
           and (
             has_function_privilege('anon', p.oid, 'EXECUTE')
             or has_function_privilege('authenticated', p.oid, 'EXECUTE')
           )`,
      );

      expect(result.rows).toEqual([]);
    });
  },
);
