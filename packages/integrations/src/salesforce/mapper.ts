import { createHash, randomUUID } from "node:crypto";

import type { SalesforceOpportunity } from "./client";

/**
 * Maps a Salesforce Opportunity onto the shape `parseSourceLeadRecord`
 * (`@signaldesk/schemas`) expects — mirrors `mapHubSpotDealToSourceLeadRecord`
 * exactly (ADR 0008's own pattern). Deliberately returns a plain
 * `unknown`-shaped object rather than depending on the schemas package
 * directly — runtime validation stays at the real boundary (the caller in
 * apps/web), matching this project's existing "validate at the source
 * boundary" rule rather than duplicating it here.
 *
 * Known simplification, same class as HubSpot's own: a bare Opportunity
 * has no direct contact — Salesforce only exposes that through a related
 * Contact/Account query this slice doesn't make yet. Both `contactName`
 * and `companyName` fall back to the opportunity's own name until that
 * lookup exists; this is honest about what is actually known today, not a
 * placeholder pretending to be real contact data.
 */

const DEFAULT_CURRENCY = "USD";
const DEFAULT_EXPECTED_RESPONSE_HOURS = 24;
const FALLBACK_OPPORTUNITY_NAME = "Untitled Salesforce opportunity";

export interface MapSalesforceOpportunityOptions {
  readonly now: Date;
  readonly expectedResponseHours?: number;
}

function isOpportunityNameMissing(opportunity: SalesforceOpportunity): boolean {
  return !opportunity.Name?.trim();
}

/**
 * Reports which critical fields this opportunity would need a fallback
 * for, without performing the mapping itself — same schema-drift-
 * visibility extension point as `detectHubSpotDealDefaultedFields`
 * (issue 5, `docs/25-issue-audit.md`). Deliberately additive; never
 * changes mapping behavior itself.
 */
export function detectSalesforceOpportunityDefaultedFields(
  opportunity: SalesforceOpportunity,
): readonly string[] {
  return isOpportunityNameMissing(opportunity) ? ["Name"] : [];
}

export function mapSalesforceOpportunityToSourceLeadRecord(
  opportunity: SalesforceOpportunity,
  options: MapSalesforceOpportunityOptions,
): unknown {
  const name = isOpportunityNameMissing(opportunity)
    ? FALLBACK_OPPORTUNITY_NAME
    : opportunity.Name!.trim();

  const recordDigestSha256 = createHash("sha256")
    .update(JSON.stringify(opportunity))
    .digest("hex");

  return {
    id: randomUUID(),
    contactName: name,
    companyName: name,
    valueCents:
      typeof opportunity.Amount === "number" && opportunity.Amount >= 0
        ? Math.round(opportunity.Amount * 100)
        : 0,
    currency: DEFAULT_CURRENCY,
    owner: opportunity.Owner
      ? { id: opportunity.Owner.Id, name: opportunity.Owner.Name }
      : null,
    stage: opportunity.StageName?.trim() || "unknown",
    createdAt: new Date(opportunity.CreatedDate).toISOString(),
    // The Opportunity object has no "last contact" field of its own —
    // that lives on Activities/Tasks, not implemented yet — so this is
    // honestly null rather than guessed from an unrelated timestamp.
    lastInteractionAt: null,
    expectedResponseHours:
      options.expectedResponseHours ?? DEFAULT_EXPECTED_RESPONSE_HOURS,
    source: {
      system: "salesforce",
      externalRecordId: opportunity.Id,
      sourceVersion: opportunity.LastModifiedDate,
      recordDigestSha256,
      lastSyncedAt: options.now.toISOString(),
    },
  };
}
