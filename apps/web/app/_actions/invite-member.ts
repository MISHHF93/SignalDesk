"use server";

import { sendEmail } from "@signaldesk/integrations/resend";
import {
  createDatabasePool,
  createOrganizationInvite,
  type DatabasePool,
  type InviteRole,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getRequestOrigin } from "../_lib/request-origin";
import { getResendConfig } from "../_lib/resend-config";
import { getCurrentOrganization } from "../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export interface InviteMemberState {
  readonly error: string | null;
  readonly message: string | null;
}

const INVITE_ROLES = new Set<InviteRole>(["admin", "member", "viewer"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Invites a real teammate (Phase 3, implementation roadmap) — creates a
 * real, pending `organization_invites` row (`createOrganizationInvite`,
 * `@signaldesk/persistence`) and, when Resend is configured, emails a
 * real accept link. Owner/admin only — RLS scopes the write to this
 * organization's tenant, but role authorization (who may invite) is this
 * Server Action's job, the same division of labor every other real
 * write in this app already uses.
 *
 * When email delivery isn't configured (`RESEND_API_KEY`/
 * `RESEND_FROM_EMAIL` unset), the invite is still real and created — the
 * link is returned in `message` so an owner/admin can share it manually,
 * rather than blocking the whole feature on an unrelated missing
 * credential. Never claims "email sent" unless it actually was.
 */
export async function inviteMemberAction(
  _prevState: InviteMemberState,
  formData: FormData,
): Promise<InviteMemberState> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { error: "Sign in to do this.", message: null };
    }

    if (session.role !== "owner" && session.role !== "admin") {
      return {
        error: "Only an owner or admin can invite a teammate.",
        message: null,
      };
    }

    const rateLimit = await checkRateLimit(
      getPool(),
      `invite-member:${session.organizationId}`,
      20,
      60 * 60 * 1000,
    );

    if (!rateLimit.allowed) {
      return {
        error: "Too many invites sent. Try again shortly.",
        message: null,
      };
    }

    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const role = String(formData.get("role") ?? "");

    if (!EMAIL_PATTERN.test(email)) {
      return { error: "Enter a real email address.", message: null };
    }

    if (!INVITE_ROLES.has(role as InviteRole)) {
      return { error: "Choose a valid role.", message: null };
    }

    // createOrganizationInvite records the audit event itself, in the
    // same transaction as the insert (packages/persistence's own
    // established same-transaction pattern for a policy-relevant write —
    // see that function's doc comment) — a separate call here used to
    // duplicate it, after the transaction had already committed.
    const { token } = await createOrganizationInvite(
      getPool(),
      session.organizationId,
      session.userId,
      { email, role: role as InviteRole },
    );

    const origin = await getRequestOrigin();
    const acceptUrl = `${origin}/signup?invite=${token}`;

    const resendConfig = getResendConfig();

    if (!resendConfig) {
      return {
        error: null,
        message: `Invite created for ${email}. Email delivery isn't configured for this deployment yet — share this link directly: ${acceptUrl}`,
      };
    }

    const html = `<p>You've been invited to join a SignalDesk workspace.</p><p><a href="${escapeHtml(acceptUrl)}">Accept the invite</a></p><p>This link expires in 7 days.</p>`;

    await sendEmail({
      apiKey: resendConfig.apiKey,
      from: resendConfig.fromAddress,
      to: email,
      subject: "You're invited to join a SignalDesk workspace",
      html,
    });

    return { error: null, message: `Invite sent to ${email}.` };
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to send the invite."),
      message: null,
    };
  }
}
