/**
 * Stripe Billing credentials — this app charging its own customers,
 * separate from the Stripe Connect connector (`stripe-config.ts`, which
 * reads a customer's own Stripe revenue data). Both can reuse the same
 * `STRIPE_SECRET_KEY` (they're unrelated API surfaces of one account),
 * but billing needs two more: a publishable key for the client-side
 * Payment Element, and a webhook signing secret.
 */
export function isBillingConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
}

export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error(
      "Billing is not configured. Set STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.",
    );
  }

  return key;
}

/**
 * "test" unless the secret key itself is a live key (`sk_live_...`) — the
 * mode is derived from the actual key in use, never a separately-set flag
 * that could drift from which key is really configured, closing off the
 * whole class of bug where `stripe_mode` in the database disagrees with
 * which Stripe environment a row's ids actually belong to.
 */
export function getStripeMode(): "test" | "live" {
  const key = getStripeSecretKey();
  return key.startsWith("sk_live_") ? "live" : "test";
}

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      "Stripe webhook signing is not configured. Set STRIPE_WEBHOOK_SECRET.",
    );
  }

  return secret;
}

/**
 * Picks the test or live Stripe price/product id off a catalog row based
 * on the mode the currently-configured secret key actually is — never
 * off a separately-tracked flag. Null (not thrown) when the catalog row
 * genuinely has no id for that mode yet, e.g. the sync script hasn't been
 * run against a real Stripe account — the caller decides how to react
 * (usually: render as "not yet available for checkout," matching the
 * connector "not configured" pattern).
 */
export function resolveStripePriceId(row: {
  readonly stripePriceIdTest: string | null;
  readonly stripePriceIdLive: string | null;
}): string | null {
  return getStripeMode() === "live"
    ? row.stripePriceIdLive
    : row.stripePriceIdTest;
}
