import { DatabaseError } from "pg";
import { describe, expect, it } from "vitest";

import { QueryFailedError, wrapDatabaseError } from "./query-error";

describe("wrapDatabaseError", () => {
  it("wraps a real schema-level DatabaseError (a genuine constraint violation) into a safe QueryFailedError", () => {
    // Matches a real unique-violation shape, confirmed live against the
    // dev database before writing this test: `table`/`constraint`/`detail`
    // are exactly what Postgres populates for a real constraint failure,
    // never for this app's own deliberate `raise exception`.
    const raw = new DatabaseError(
      'duplicate key value violates unique constraint "organizations_stripe_customer_id_key"',
      0,
      "error",
    );
    raw.code = "23505";
    raw.table = "organizations";
    raw.constraint = "organizations_stripe_customer_id_key";
    raw.detail =
      "Key (stripe_customer_id)=(cus_real_customer_id) already exists.";

    const wrapped = wrapDatabaseError(raw);

    expect(wrapped).toBeInstanceOf(QueryFailedError);
    const error = wrapped as QueryFailedError;
    expect(error.message).not.toContain("cus_real_customer_id");
    expect(error.message).not.toContain("constraint");
    expect(error.message).toContain("database operation failed");
    expect(error.rawDetail).toContain("23505");
    expect(error.rawDetail).toContain("cus_real_customer_id");
  });

  it("leaves this app's own deliberate `raise exception` untouched (confirmed live shape: a SQLSTATE but no table/constraint/detail)", () => {
    // Every `raise exception` this app's migrations author sets an
    // explicit `using errcode = ...` (confirmed against every site:
    // packages/persistence/drizzle/*.sql) but never populates
    // table/constraint/detail, since it isn't attached to a specific
    // constraint — this is the real, live shape of e.g. "integration %
    // not found in the current tenant context" (SQLSTATE 42501).
    const raised = new DatabaseError(
      "integration 00000000-0000-0000-0000-000000000000 not found in the current tenant context",
      0,
      "error",
    );
    raised.code = "42501";

    expect(wrapDatabaseError(raised)).toBe(raised);
  });

  it("leaves a hand-thrown application Error untouched", () => {
    const applicationError = new Error(
      "No stored QuickBooks tokens for this integration.",
    );

    expect(wrapDatabaseError(applicationError)).toBe(applicationError);
  });

  it("leaves a non-Error thrown value untouched", () => {
    const thrown = "a string was thrown";

    expect(wrapDatabaseError(thrown)).toBe(thrown);
  });
});
