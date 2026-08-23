/**
 * Resend email configuration — server-only env reads, mirroring
 * `quickbooks-config.ts`/`agent-config.ts`'s pattern: `packages/integrations`
 * stays free of `process.env` access, so this gate lives here at the app
 * layer. Unset ⇒ inert, same "real client, gated behind an unset key"
 * convention as every credential in this app — `emailDailyBriefAction`
 * returns an honest "not configured" error rather than a silent failure.
 */
export interface ResendConfig {
  readonly apiKey: string;
  readonly fromAddress: string;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export function getResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromAddress) {
    return null;
  }

  return { apiKey, fromAddress };
}
