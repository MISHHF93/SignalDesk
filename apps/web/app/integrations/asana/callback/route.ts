import { NextResponse } from "next/server";

import {
  exchangeAsanaAuthorizationCode,
  fetchAsanaTasks,
  fetchAsanaWorkspaces,
  mapAsanaTaskToSourceTaskRecord,
  type AsanaTask,
} from "@business-dashboard/integrations/asana";
import {
  canAddActiveConnection,
  createDatabasePool,
  findOrCreateAsanaIntegration,
  ingestAsanaTask,
  recordAuditEvent,
  storeAsanaTokens,
} from "@business-dashboard/persistence";
import { parseSourceTaskRecord } from "@business-dashboard/schemas";

import { getAsanaOAuthConfig } from "../../../_lib/asana-config";
import { consumeOAuthState } from "../../../_lib/oauth-state";
import { checkRateLimit, getClientIp } from "../../../_lib/rate-limit";
import { getCurrentOrganization } from "../../../_lib/session";

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

// Bounds the synchronous-in-request initial sync per workspace, mirroring
// HubSpot's/QuickBooks's own page-count stopgaps and for the same reason.
const MAX_TASK_PAGES_PER_WORKSPACE = 20;

/**
 * Completes the Asana OAuth flow and runs a one-time initial sync of
 * overdue, incomplete tasks assigned to the connected user across every
 * workspace they belong to — the third real connector sync in this app
 * (HubSpot deals, QuickBooks invoices, now Asana tasks), mirroring their
 * structure exactly. Stores tokens in Vault and records which Asana user
 * connected (the token response's own `data.gid`/`data.email` — no
 * separate identity call needed, unlike Linear). Incremental/recurring
 * sync is explicitly future work, same as the other two.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const redirectTo = (status: string) =>
    NextResponse.redirect(`${origin}/integrations/asana?asana=${status}`);

  if (oauthError) {
    return redirectTo("denied");
  }

  if (!code) {
    return redirectTo("error");
  }

  const rateLimit = checkRateLimit(
    `asana-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return redirectTo("error");
  }

  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.redirect(`${origin}/login?next=/integrations/asana`);
  }

  // Real CSRF defense: `state` must match the single-use nonce this
  // browser was issued when it started the flow (RFC 6749 §10.12) — never
  // trust a client-supplied value alone.
  const stateIsValid = await consumeOAuthState("asana", state);

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
    const config = getAsanaOAuthConfig(origin);
    const tokens = await exchangeAsanaAuthorizationCode(config, code);

    const integration = await findOrCreateAsanaIntegration(
      getPool(),
      session.organizationId,
      tokens.asanaUserId,
      tokens.email,
    );

    await storeAsanaTokens(getPool(), session.organizationId, integration.id, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    });

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "integration.connected",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: { sourceSystem: "asana", asanaUserId: tokens.asanaUserId },
    });

    const now = new Date();
    let ingested = 0;
    let skipped = 0;

    const workspaces = await fetchAsanaWorkspaces(tokens.accessToken);

    for (const workspace of workspaces) {
      let offset: string | undefined;

      for (let page = 0; page < MAX_TASK_PAGES_PER_WORKSPACE; page += 1) {
        const taskPage = await fetchAsanaTasks(
          tokens.accessToken,
          tokens.asanaUserId,
          workspace.gid,
          offset,
        );

        for (const rawTask of taskPage.results as readonly AsanaTask[]) {
          const mapped = mapAsanaTaskToSourceTaskRecord(rawTask, now);

          if (mapped === null) {
            // No due date set on the source task — "overdue" doesn't
            // apply, not a validation failure (see the mapper's doc
            // comment). Not counted as skipped: nothing was wrong with it.
            continue;
          }

          // Real runtime validation of external data at the boundary
          // (`sourceTaskRecordSchema`'s own contract), mirroring the
          // HubSpot/QuickBooks loops' own reasoning: one malformed task is
          // skipped rather than aborting the whole sync for every other
          // task in this workspace.
          let taskRecord: ReturnType<typeof parseSourceTaskRecord>;

          try {
            taskRecord = parseSourceTaskRecord(mapped, {
              organizationId: session.organizationId,
              integrationId: integration.id,
            });
          } catch (validationError) {
            console.error(
              `Skipping Asana task ${rawTask.gid}: failed validation`,
              validationError,
            );
            skipped += 1;
            continue;
          }

          const result = await ingestAsanaTask(
            getPool(),
            session.organizationId,
            integration.id,
            {
              externalRecordId: taskRecord.source.externalRecordId,
              sourceVersion: taskRecord.source.sourceVersion,
              rawPayloadSha256: taskRecord.source.recordDigestSha256,
              rawPayloadByteLength: JSON.stringify(rawTask).length,
              observedAt: now,
              name: taskRecord.name,
              assigneeName: taskRecord.assigneeName,
              dueAt: taskRecord.dueAt,
              completed: taskRecord.completed,
            },
          );

          if (result.inserted) {
            ingested += 1;
          }
        }

        if (!taskPage.nextOffset) {
          break;
        }

        offset = taskPage.nextOffset;
      }
    }

    if (skipped > 0) {
      console.error(
        `Asana initial sync for integration ${integration.id}: skipped ${skipped} task(s) that failed validation.`,
      );
    }

    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "sync.completed",
      subjectType: "integration",
      subjectId: integration.id,
      outcome: "succeeded",
      metadata: { sourceSystem: "asana", tasksIngested: ingested },
    });

    return NextResponse.redirect(
      `${origin}/integrations/asana?asana=connected&synced=${ingested}`,
    );
  } catch (error) {
    console.error("Asana OAuth callback failed", error);
    return redirectTo("error");
  }
}
