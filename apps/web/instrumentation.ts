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
  ] as const;

  for (const [providerLabel, idVar, secretVar] of oauthConnectorEnvPairs) {
    const hasId = Boolean(process.env[idVar]);
    const hasSecret = Boolean(process.env[secretVar]);

    if (hasId !== hasSecret) {
      console.error(
        `Configuration warning: only one of ${idVar} / ${secretVar} is set. ${providerLabel} will report as unconfigured until both are set — a half-set pair is likely a mistake, not an intentional partial configuration.`,
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
    console.error(
      `Configuration warning: NEXT_PUBLIC_ENABLED_OAUTH_PROVIDERS lists unrecognized provider id(s): ${unknownProviderIds.join(", ")}. Valid ids are: ${[...validProviderIds].join(", ")}. An unrecognized id silently never renders a working button — this is very likely a typo.`,
    );
  }
}
