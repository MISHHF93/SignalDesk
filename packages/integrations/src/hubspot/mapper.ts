import { createHash, randomUUID } from "node:crypto";

import type { HubSpotDeal } from "./client";

/**
 * Maps a HubSpot Deal onto the shape `parseSourceLeadRecord`
 * (`@signaldesk/schemas`) expects. Deliberately returns a plain
 * `unknown`-shaped object rather than depending on the schemas package
 * directly — runtime validation stays at the real boundary (the caller in
 * apps/web), matching this project's existing "validate at the source
 * boundary" rule rather than duplicating it here.
 *
 * Known simplification (ADR 0008's declared out-of-scope list): a bare
 * Deal has no direct contact or company name — HubSpot only exposes those
 * through the Associations API, which this slice does not call yet. Both
 * `contactName` and `companyName` fall back to the deal's own name until
 * that association lookup exists; this is honest about what is actually
 * known today, not a placeholder pretending to be real contact data.
 */

const DEFAULT_CURRENCY = "USD";
const DEFAULT_EXPECTED_RESPONSE_HOURS = 24;
const FALLBACK_DEAL_NAME = "Untitled HubSpot deal";

export interface MapHubSpotDealOptions {
  readonly now: Date;
  readonly ownerNamesById: ReadonlyMap<string, string>;
  readonly expectedResponseHours?: number;
}

function parseAmountToCents(amount: string | null | undefined): number {
  if (!amount) {
    return 0;
  }

  const parsed = Number.parseFloat(amount);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed * 100);
}

/**
 * True when the deal has no usable `dealname` at all — every real HubSpot
 * deal has one, so its absence is a genuine anomaly (a permissions/scope
 * issue, or HubSpot renaming the field) worth surfacing, unlike a missing
 * `amount` (a completely normal, honest state for an early-pipeline deal
 * with no negotiated price yet — flagging that as "drift" would misreport
 * ordinary business data as a data-quality problem). Shared by the mapper
 * itself and `detectHubSpotDealDefaultedFields` below so the two can never
 * silently disagree about what counts as missing.
 */
function isDealNameMissing(props: HubSpotDeal["properties"]): boolean {
  return !props.dealname?.trim();
}

/**
 * Reports which critical fields this deal would need a fallback for,
 * without performing the mapping itself — the real extension point for
 * schema-drift visibility (issue 5, `docs/25-issue-audit.md`: "Integration
 * Schema Drift"): a provider renaming `dealname` would otherwise silently
 * produce a plausible-looking `"Untitled HubSpot deal"` lead with no
 * operator-visible signal, since Zod validation only rejects a shape it
 * can't parse at all, never a value that defaulted to something
 * technically valid. Deliberately additive — a caller decides what to do
 * with a non-empty result (e.g. a real audit event); this never changes
 * mapping behavior itself.
 */
export function detectHubSpotDealDefaultedFields(
  deal: HubSpotDeal,
): readonly string[] {
  return isDealNameMissing(deal.properties) ? ["dealname"] : [];
}

export function mapHubSpotDealToSourceLeadRecord(
  deal: HubSpotDeal,
  options: MapHubSpotDealOptions,
): unknown {
  const props = deal.properties;
  const dealName = isDealNameMissing(props)
    ? FALLBACK_DEAL_NAME
    : props.dealname!.trim();
  const ownerId = props.hubspot_owner_id?.trim() || null;
  const ownerName = ownerId ? options.ownerNamesById.get(ownerId) : undefined;

  const recordDigestSha256 = createHash("sha256")
    .update(JSON.stringify({ id: deal.id, properties: props }))
    .digest("hex");

  const createdAt = props.createdate ?? deal.createdAt;
  const sourceVersion = props.hs_lastmodifieddate ?? deal.updatedAt;

  return {
    id: randomUUID(),
    contactName: dealName,
    companyName: dealName,
    valueCents: parseAmountToCents(props.amount),
    currency: DEFAULT_CURRENCY,
    owner: ownerId
      ? { id: ownerId, name: ownerName ?? `HubSpot owner ${ownerId}` }
      : null,
    stage: props.dealstage?.trim() || "unknown",
    createdAt: new Date(createdAt).toISOString(),
    // The Deals API has no "last contact" field of its own — that lives on
    // Engagements, not implemented yet — so this is honestly null rather
    // than guessed from an unrelated timestamp.
    lastInteractionAt: null,
    expectedResponseHours:
      options.expectedResponseHours ?? DEFAULT_EXPECTED_RESPONSE_HOURS,
    source: {
      system: "hubspot",
      externalRecordId: deal.id,
      sourceVersion,
      recordDigestSha256,
      lastSyncedAt: options.now.toISOString(),
    },
  };
}
