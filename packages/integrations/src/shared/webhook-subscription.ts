/**
 * The target shape for a generic, per-connection, multi-tenant webhook
 * subscription record — still no table, no runtime code built against
 * this type. QuickBooks now has a real inbound webhook (ADR 0022,
 * `apps/web/app/integrations/quickbooks/webhook/route.ts`), but it isn't
 * an instance of this type: Intuit configures webhooks once per app, not
 * per connection, so there is exactly one endpoint and one static
 * verifier token (an environment variable), not a `WebhookSubscription`
 * row per tenant to store. This type remains pure documentation of
 * intent for the day a provider's webhook model actually needs
 * per-connection subscription records — matching
 * `ConnectorImplementationGateId`'s existing pattern of typing intent
 * without runtime code for ungated features. See ADR 0021's
 * explicitly-out-of-scope list.
 */
export type WebhookSubscriptionStatus = "active" | "disabled" | "failing";

export interface WebhookSubscription {
  readonly id: string;
  readonly connectionId: string;
  readonly sourceSystem: string;
  readonly eventTypes: readonly string[];
  readonly endpointUrl: string;
  readonly secretRef: string;
  readonly status: WebhookSubscriptionStatus;
  readonly createdAt: Date;
}
