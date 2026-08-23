import { DatabaseError } from "pg";

/**
 * Thrown in place of a raw `pg` `DatabaseError` once it's crossed
 * `withTenantContext`'s boundary. `message` is always a safe, generic
 * sentence — never the raw Postgres error text — so it can be shown to a
 * client verbatim the same way `describeActionError` already does for any
 * plain `Error`. The real diagnostic detail (SQLSTATE code + the driver's
 * own message, which can echo back literal column values on a constraint
 * violation, e.g. `Key (email)=(user@example.com) already exists.`) lives
 * in `rawDetail`, read only by server-side logging/error-reporting.
 *
 * Found by the same class of audit that found the connector layer's
 * equivalent gap (`packages/integrations/src/shared/upstream-error.ts`,
 * 2026-08-22): every Server Action's catch block already returns any
 * plain `Error.message` verbatim to the client (`describe-action-error.ts`),
 * and `withTenantContext` — the one choke point every tenant-scoped query
 * in this app goes through — previously re-threw a caught `DatabaseError`
 * completely unwrapped.
 */
export class QueryFailedError extends Error {
  readonly rawDetail: string;

  constructor(rawDetail: string) {
    super(
      "A database operation failed. Please try again, or contact support if the problem continues.",
    );
    this.name = "QueryFailedError";
    this.rawDetail = rawDetail;
  }
}

// Every `raise exception '...'` this app's own migrations author sets an
// explicit `using errcode = '...'` (`42501` for a tenant-isolation check,
// `23514` for the immutable-column guard) — so SQLSTATE alone can't
// distinguish "this app's own deliberate, safe raise" from a genuine
// Postgres-native error carrying the same code (a real CHECK-constraint
// violation is also `23514`). What *does* reliably distinguish them,
// confirmed live against both a deliberate raise and a real foreign-key
// violation before writing this (not assumed): only a real
// constraint/schema-level error populates `table`/`constraint`/`detail`
// on the `pg` `DatabaseError` — a manual `RAISE` from PL/pgSQL never does,
// since it isn't attached to any specific constraint. `detail` in
// particular is exactly where a real unique-violation echoes back the
// literal conflicting value (e.g. `Key (email)=(user@example.com) already
// exists.`), so it's the single highest-value field to keep out of a
// client-visible message.
function isSchemaLevelError(error: DatabaseError): boolean {
  return (
    error.table !== undefined ||
    error.constraint !== undefined ||
    error.detail !== undefined
  );
}

/**
 * Wraps a real, schema-level `pg` `DatabaseError` (a genuine constraint
 * violation this app's own code didn't author the message for). Never
 * touches a plain, hand-thrown `Error` from application code running
 * inside `withTenantContext`'s callback (e.g. `"No stored QuickBooks
 * tokens for this integration."`), and never touches a deliberate
 * `raise exception` from this app's own PL/pgSQL, either — both are
 * already safe, already-authored text this app relies on reaching the
 * client, confirmed by several existing tests asserting on their exact
 * wording.
 */
export function wrapDatabaseError(error: unknown): unknown {
  if (error instanceof DatabaseError && isSchemaLevelError(error)) {
    const detail = error.detail ? ` ${error.detail}` : "";

    return new QueryFailedError(
      `${error.code ?? "unknown"}: ${error.message}${detail}`,
    );
  }

  return error;
}
