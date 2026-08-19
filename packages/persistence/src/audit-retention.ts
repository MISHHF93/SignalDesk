/**
 * The one retention class that exists today. Previously duplicated as an
 * identical SQL literal in both `audit-events.ts` and `internal-tasks.ts`'s
 * inline audit insert — harmless while both copies agreed, but exactly the
 * kind of drift risk that shows up the moment a second retention class is
 * ever needed and only one copy gets updated.
 */
export const STANDARD_AUDIT_RETENTION_CLASS = "standard";
export const STANDARD_AUDIT_RETENTION_INTERVAL = "1 year";
