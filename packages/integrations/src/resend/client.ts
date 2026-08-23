/**
 * A real, minimal Resend API client — Notification & Escalation Policy's
 * first real delivery channel (Prompt 32, docs/product-vision-backlog.md,
 * ADR 0041). Not a connector (no OAuth, no business data read), so this
 * deliberately isn't in `connectorCatalog` — it's an outbound delivery
 * mechanism `apps/web` calls directly, the same "real client, gated
 * behind an unset key, inert until configured" pattern
 * `createClaudeProvider()`/Stripe billing already established elsewhere
 * in this app rather than a live network call this package makes itself
 * at import time.
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";
import { throwUpstreamError } from "../shared/upstream-error";

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailInput {
  readonly apiKey: string;
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly html: string;
}

export interface SendEmailResult {
  readonly id: string;
}

interface RawResendResponse {
  readonly id?: string;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const response = await fetchWithRetry(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    await throwUpstreamError("Email send", response);
  }

  const payload = (await response.json()) as RawResendResponse;

  if (!payload.id) {
    throw new Error("Resend email send succeeded but returned no message id");
  }

  return { id: payload.id };
}
