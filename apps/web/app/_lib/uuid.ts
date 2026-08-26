/**
 * Shared by every Server Action that accepts a client-generated id as its
 * own future primary key (`run-agent-investigation.ts`,
 * `draft-entity-content-action.ts`, `draft-message-reply-action.ts` —
 * docs/adr/0063-agent-investigation-progress.md) — validated up front
 * rather than trusted: RLS and the row's own organization-scoped
 * uniqueness constraint are the real safety boundary, but a clear "invalid
 * id" is a better failure than an obscure Postgres type error for a
 * malformed value.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
