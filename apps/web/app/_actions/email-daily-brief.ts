"use server";

import { sendEmail } from "@signaldesk/integrations/resend";
import {
  createDatabasePool,
  getLatestArtifact,
  type DatabasePool,
} from "@signaldesk/persistence";

import { describeActionError } from "../_lib/describe-action-error";
import { checkRateLimit } from "../_lib/rate-limit";
import { getResendConfig } from "../_lib/resend-config";
import { getCurrentOrganization } from "../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export type EmailDailyBriefActionResult =
  | { readonly ok: true; readonly sentTo: string }
  | { readonly ok: false; readonly error: string };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Emails the organization's most recently generated Daily Brief to the
 * signed-in user's own account email — Notification & Escalation Policy's
 * first real delivery channel (Prompt 32, docs/adr/0041-notification-email-delivery.md).
 * Deliberately does NOT claim to fulfill `morningBriefEnabled`'s scheduled
 * delivery toggle: true scheduled delivery needs cron/deployment
 * infrastructure this app doesn't have. This is a real, on-demand send of
 * real content — inert with an honest error until RESEND_API_KEY and
 * RESEND_FROM_EMAIL are both configured.
 */
export async function emailDailyBriefAction(): Promise<EmailDailyBriefActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    if (!session.email) {
      return {
        ok: false,
        error:
          "Your account has no email address to send to (guest workspaces can't receive email).",
      };
    }

    const config = getResendConfig();

    if (!config) {
      return {
        ok: false,
        error: "Email delivery isn't configured for this deployment yet.",
      };
    }

    // Real gap found by review: this is a real, cost-incurring Resend
    // send with no throttle at all, unlike every other action here that
    // calls sendEmail (invite-member.ts's own rate limit is the sibling
    // pattern) — a user could otherwise spam-click "Email me this" for
    // unlimited sends.
    const rateLimit = await checkRateLimit(
      getPool(),
      `email-daily-brief:${session.organizationId}`,
      10,
      60 * 60 * 1000,
    );

    if (!rateLimit.allowed) {
      return {
        ok: false,
        error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before emailing the brief again.`,
      };
    }

    const brief = await getLatestArtifact(
      getPool(),
      session.organizationId,
      "daily_brief",
    );

    if (!brief) {
      return {
        ok: false,
        error: "Generate a Daily Brief first, then email it.",
      };
    }

    const html = `<pre style="font-family: monospace; white-space: pre-wrap;">${escapeHtml(brief.content)}</pre>`;

    await sendEmail({
      apiKey: config.apiKey,
      from: config.fromAddress,
      to: session.email,
      subject: brief.title,
      html,
    });

    return { ok: true, sentTo: session.email };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to email the Daily Brief."),
    };
  }
}
