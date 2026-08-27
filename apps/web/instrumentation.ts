import { logger } from "./app/_lib/logger";
import { oauthProviders } from "./app/_lib/oauth-providers";

/**
 * Real startup validation, not lazy per-request checks. `register()` runs
 * once when a new Next.js server instance starts and "must complete
 * before the server is ready to handle requests" (Next.js's own
 * instrumentation.js docs) — the right place to fail fast on
 * misconfiguration instead of discovering it on the first real request.
 *
 * Genuinely required vars (nothing works without them) throw, which
 * prevents the server from becoming ready at all. Optional-but-easy-to-
 * misconfigure vars (HubSpot half-set, a typo'd OAuth provider id) only
 * warn — the rest of the app is fully functional without them, so a hard
 * crash would be disproportionate to what's actually wrong.
 */
export function register(): void {
  const missing: string[] = [];

  if (!process.env.DATABASE_URL) {
    missing.push("DATABASE_URL");
  } else if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL)) {
    throw new Error(
      "DATABASE_URL is set but doesn't look like a Postgres connection string (expected it to start with postgres:// or postgresql://).",
    );
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  } else {
    try {
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    } catch {
      throw new Error(
        `NEXT_PUBLIC_SUPABASE_URL is set but isn't a valid URL: "${process.env.NEXT_PUBLIC_SUPABASE_URL}".`,
      );
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. The application cannot serve any real request without them — see .env.example.`,
    );
  }

  // Real, deployable enforcement of PRODUCTION-ACTIVATION-CHECKLIST.md
  // Stage 7 — not a documentation-only reminder. `/legal/terms`,
  // `/legal/privacy`, and `/support` are honest, clearly-labeled
  // placeholders (not real legal text) until an owner/counsel review
  // replaces them. Setting `SIGNALDESK_PUBLIC_LAUNCH_MODE=true` is the
  // owner's own explicit signal that real customers can sign up now —
  // this refuses to start in that mode unless
  // `SIGNALDESK_LEGAL_CONTENT_REVIEWED=true` is also set, so placeholder
  // legal content can never silently go live just because the rest of the
  // launch checklist is done.
  if (
    process.env.SIGNALDESK_PUBLIC_LAUNCH_MODE === "true" &&
    process.env.SIGNALDESK_LEGAL_CONTENT_REVIEWED !== "true"
  ) {
    throw new Error(
      "SIGNALDESK_PUBLIC_LAUNCH_MODE is true but SIGNALDESK_LEGAL_CONTENT_REVIEWED is not — refusing to start with placeholder Terms of Service/Privacy Policy/Support content in public-launch mode. Set SIGNALDESK_LEGAL_CONTENT_REVIEWED=true only after an owner/counsel review has actually replaced /legal/terms, /legal/privacy, and /support's placeholder content.",
    );
  }

  const oauthConnectorEnvPairs = [
    ["HubSpot", "HUBSPOT_CLIENT_ID", "HUBSPOT_CLIENT_SECRET"],
    ["Slack", "SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
    // Stripe has no separate client secret — STRIPE_SECRET_KEY (the
    // platform's own Stripe secret key) doubles as the OAuth credential
    // (see app/_lib/stripe-config.ts), but the same half-set mistake is
    // just as possible with this pair.
    ["Stripe", "STRIPE_CLIENT_ID", "STRIPE_SECRET_KEY"],
    ["QuickBooks", "QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET"],
    // Shared by both Gmail and Google Calendar (see app/_lib/google-config.ts).
    ["Google", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    // Shared by both Outlook and Microsoft Calendar (see
    // app/_lib/microsoft-config.ts).
    ["Microsoft", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
    ["Asana", "ASANA_CLIENT_ID", "ASANA_CLIENT_SECRET"],
    ["Linear", "LINEAR_CLIENT_ID", "LINEAR_CLIENT_SECRET"],
    ["Salesforce", "SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET"],
    ["Xero", "XERO_CLIENT_ID", "XERO_CLIENT_SECRET"],
    ["Jira", "JIRA_CLIENT_ID", "JIRA_CLIENT_SECRET"],
    ["Zendesk", "ZENDESK_CLIENT_ID", "ZENDESK_CLIENT_SECRET"],
  ] as const;

  for (const [providerLabel, idVar, secretVar] of oauthConnectorEnvPairs) {
    const hasId = Boolean(process.env[idVar]);
    const hasSecret = Boolean(process.env[secretVar]);

    if (hasId !== hasSecret) {
      logger.log(
        "warn",
        `Configuration warning: only one of ${idVar} / ${secretVar} is set. ${providerLabel} will report as unconfigured until both are set — a half-set pair is likely a mistake, not an intentional partial configuration.`,
        { operation: "startup.oauth_config_validation" },
      );
    }
  }

  const validProviderIds = new Set(
    oauthProviders.map((provider) => provider.id),
  );
  const configuredProviderIds = (
    process.env.NEXT_PUBLIC_ENABLED_OAUTH_PROVIDERS ?? ""
  )
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const unknownProviderIds = configuredProviderIds.filter(
    (id) => !validProviderIds.has(id as (typeof oauthProviders)[number]["id"]),
  );

  if (unknownProviderIds.length > 0) {
    logger.log(
      "warn",
      `Configuration warning: NEXT_PUBLIC_ENABLED_OAUTH_PROVIDERS lists unrecognized provider id(s): ${unknownProviderIds.join(", ")}. Valid ids are: ${[...validProviderIds].join(", ")}. An unrecognized id silently never renders a working button — this is very likely a typo.`,
      { operation: "startup.oauth_config_validation" },
    );
  }
}
