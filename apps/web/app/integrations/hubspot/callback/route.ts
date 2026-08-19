import { NextResponse } from "next/server";

import {
  exchangeHubSpotAuthorizationCode,
  fetchHubSpotDeals,
  fetchHubSpotOwners,
  mapHubSpotDealToSourceLeadRecord,
  type HubSpotDeal,
} from "@business-dashboard/integrations/hubspot";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateHubSpotIntegration,
  getOrganizationBusinessProfile,
  ingestHubSpotDeal,
  recordAuditEvent,
  storeHubSpotTokens,
} from "@business-dashboard/persistence";
import { parseSourceLeadRecord } from "@business-dashboard/schemas";

import { getHubSpotOAuthConfig } from "../../../_lib/hubspot-config";
import { consumeOAuthState } from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

// Bounds the synchronous-in-request initial sync to at most 2,000 deals
// (20 pages of 100). This is a stopgap so one very large HubSpot account
// can't hang the OAuth callback indefinitely — a real background sync job
// (ADR 0008's explicit future work) is what removes this cap, not a higher
// number here.
const MAX_DEAL_PAGES = 20;

/**
 * Completes the HubSpot OAuth flow and runs a one-time initial sync
 * (ADR 0008): stores tokens in Vault, then fetches and ingests every open
 * deal up to `MAX_DEAL_PAGES` pages. Incremental/recurring sync is
 * explicitly future work — this proves the pipe works end to end, not a
 * production sync engine.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(`${origin}/integrations/hubspot?hubspot=${status}`);

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = checkRateLimit(
    `hubspot-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(`${origin}/login?next=/integrations/hubspot`);
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone. This is layered with, not a
  // substitute for, the real authorization being this re-derived session.
  const stateIsValid = await consumeOAuthState("hubspot", state);

  if (!stateIsValid) {
    return redirectTo("error");
  }

  // Real entitlement enforcement: bills by active connections, so a new
  // one is rejected before it's created if the org is already at its
  // plan's limit — checked before the token exchange so a rejected
  // connection doesn't burn the single-use authorization code.
  if (!(await canAddActiveConnection(getPool(), session.organizationId))) {
    return redirectTo("limit");
  }

  try {
    const config = getHubSpotOAuthConfig(origin);
    const tokens = await exchangeHubSpotAuthorizationCode(config, code);

    const integration = await findOrCreateHubSpotIntegration(
      getPool(),
      session.organizationId,
      tokens.hubId,
    );

    await storeHubSpotTokens(
      getPool(),
      session.organizationId,
      integration.id,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
    );

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "integration.connected",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: { sourceSystem: "hubspot", hubId: tokens.hubId },
    });

    const businessProfile = await getOrganizationBusinessProfile(
      getPool(),
      session.organizationId,
    );

    const owners = await fetchHubSpotOwners(tokens.accessToken);
    const ownerNamesById = new Map(
      owners.map((owner) => [
        owner.id,
        [owner.firstName, owner.lastName].filter(Boolean).join(" ") ||
          owner.email ||
          owner.id,
      ]),
    );

    const now = new Date();
    let ingested = 0;
    let skipped = 0;
    let after: string | undefined;

    for (let page = 0; page < MAX_DEAL_PAGES; page += 1) {
      const dealsPage = await fetchHubSpotDeals(tokens.accessToken, after);

      for (const deal of dealsPage.results as readonly HubSpotDeal[]) {
        // Real runtime validation of external data at the boundary
        // (`sourceLeadRecordSchema`'s own contract) — one malformed or
        // out-of-bounds deal (e.g. a deal name over the 500-character
        // limit the schema enforces precisely because HubSpot's own field
        // limits aren't a security control this app can rely on) is
        // skipped rather than aborting the whole sync for every other
        // deal in this account.
        let lead: ReturnType<typeof parseSourceLeadRecord>;

        try {
          lead = parseSourceLeadRecord(
            mapHubSpotDealToSourceLeadRecord(deal, {
              now,
              ownerNamesById,
              expectedResponseHours:
                businessProfile.defaultExpectedResponseHours,
            }),
            {
              organizationId: session.organizationId,
              integrationId: integration.id,
            },
          );
        } catch (validationError) {
          console.error(
            `Skipping HubSpot deal ${deal.id}: failed validation`,
            validationError,
          );
          skipped += 1;
          continue;
        }

        const result = await ingestHubSpotDeal(
          getPool(),
          session.organizationId,
          integration.id,
          {
            externalRecordId: lead.source.externalRecordId,
            sourceVersion: lead.source.sourceVersion,
            rawPayloadSha256: lead.source.recordDigestSha256,
            rawPayloadByteLength: JSON.stringify(deal).length,
            observedAt: now,
            contactName: lead.contactName,
            companyName: lead.companyName,
            stage: lead.stage,
            valueCents: lead.valueCents,
            currency: lead.currency,
            expectedResponseHours: lead.expectedResponseHours,
            sourceCreatedAt: lead.createdAt,
            lastInteractionAt: lead.lastInteractionAt,
          },
        );

        if (result.inserted) {
          ingested += 1;
        }
      }

      if (!dealsPage.nextAfter) {
        break;
      }

      after = dealsPage.nextAfter;
    }

    if (skipped > 0) {
      console.error(
        `HubSpot initial sync for integration ${integration.id}: skipped ${skipped} deal(s) that failed validation.`,
      );
    }

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "sync.completed",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: { sourceSystem: "hubspot", dealsIngested: ingested },
    });

    return NextResponse.redirect(
      `${origin}/integrations/hubspot?hubspot=connected&synced=${ingested}`,
    );
  } catch (error) {
    console.error("HubSpot OAuth callback failed", error);
    return redirectTo("error");
  }
}
