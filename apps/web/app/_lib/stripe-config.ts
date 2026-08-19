import type { StripeOAuthConfig } from "@business-dashboard/integrations/stripe";

/**
 * Stripe Connect credentials — server-only, never NEXT_PUBLIC_. Real app
 * registered at https://dashboard.stripe.com/settings/connect/onboarding-options/oauth,
 * redirect URI pointed at {origin}/integrations/stripe/callback.
 *
 * Unlike HubSpot/Slack, there is no `STRIPE_CLIENT_SECRET` — Stripe's OAuth
 * token exchange and deauthorize calls authenticate with the platform's own
 * secret API key instead (see client.ts's doc comment).
 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_CLIENT_ID && process.env.STRIPE_SECRET_KEY);
}

export function getStripeOAuthConfig(origin: string): StripeOAuthConfig {
  const clientId = process.env.STRIPE_CLIENT_ID;
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!clientId || !secretKey) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_CLIENT_ID and STRIPE_SECRET_KEY.",
    );
  }

  return {
    clientId,
    secretKey,
    redirectUri: `${origin}/integrations/stripe/callback`,
  };
}
