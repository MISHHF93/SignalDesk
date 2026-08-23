/**
 * A pure function from one provider's raw shape to a canonical Business
 * Graph entity — the contract `mapQuickBooksInvoiceToSourceInvoiceRecord`
 * (and the HubSpot/Asana equivalents) already honor informally. Returns
 * `null` when the raw record has no honest canonical representation (e.g.
 * a QuickBooks invoice with no due date) — never a validation error;
 * validation happens at the schema boundary the mapped value is later
 * passed to, not here.
 *
 * The three real mappers today predate this type and take a narrower
 * second argument (`now: Date`, or a provider-specific options object)
 * rather than `{organizationId, integrationId}` — see each mapper file's
 * own doc comment. This is the target shape for new mappers, not a
 * retrofit requirement for the existing ones; forcing their signatures to
 * match would mean passing a dishonest `context` value.
 */
export type SourceMapping<TRaw, TCanonical> = (
  raw: TRaw,
  context: { readonly organizationId: string; readonly integrationId: string },
) => TCanonical | null;
