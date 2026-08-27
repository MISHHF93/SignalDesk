"use server";

import {
  createDatabasePool,
  recordAuditEvent,
  revokeOrganizationInvite,
  type DatabasePool,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export type RevokeInviteActionResult =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

/**
 * Revokes a real pending invite (Phase 3, implementation roadmap) —
 * owner/admin only, same role check as `inviteMemberAction`. A no-op,
 * not an error, for an invite that's already accepted/revoked
 * (`revokeOrganizationInvite`'s own idempotent-write behavior).
 */
export async function revokeInviteAction(
  inviteId: string,
): Promise<RevokeInviteActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    if (session.role !== "owner" && session.role !== "admin") {
      return {
        ok: false,
        error: "Only an owner or admin can revoke an invite.",
      };
    }

    const rateLimit = await checkRateLimit(
      getPool(),
      `revoke-invite:${session.organizationId}`,
      20,
      60 * 60 * 1000,
    );

    if (!rateLimit.allowed) {
      return { ok: false, error: "Too many requests. Try again shortly." };
    }

    const revoked = await revokeOrganizationInvite(
      getPool(),
      session.organizationId,
      inviteId,
    );

    // Real gap found by review: same missing pattern as
    // inviteMemberAction's own — records honestly whether this was a real
    // state change or a no-op on an already-accepted/revoked invite
    // (`revoked`), rather than fabricating "revoked" either way.
    await recordAuditEvent(getPool(), session.organizationId, {
      userId: session.userId,
      eventType: "invite.revoked",
      subjectType: "organization_invite",
      subjectId: inviteId,
      outcome: "succeeded",
      metadata: { revoked },
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to revoke the invite."),
    };
  }
}
