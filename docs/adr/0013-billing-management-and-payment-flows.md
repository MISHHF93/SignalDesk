# ADR 0013: `/billing` — self-serve subscription management

- Status: Accepted
- Date: 2026-08-19

## Context

[ADR 0012](0012-billing-and-subscriptions.md) built real subscriptions, but for a while the only thing a signed-in customer could do with one was start it. There was no page to see subscription status, no way to cancel, resume, update a card, change plans, add capacity, or recover from a payment that never completed. A launch-readiness audit treated "a button that doesn't do anything" and "a capability with no button" as the same class of bug — both leave a real backend capability unreachable — and this closed the second half for billing specifically.

## Decision

**One page, `/billing`, gated by session, is the entire subscription management surface.** It fetches the organization's subscription, plan, entitlement usage, the self-serve plan catalog, and purchased add-ons in parallel, and renders exactly the actions valid for the subscription's current `status` — nothing is shown that wouldn't work if clicked.

**Cancel means `cancel_at_period_end`, not an immediate stop.** `cancelSubscriptionAction`/`resumeSubscriptionAction` toggle Stripe's `cancel_at_period_end` flag — the standard SaaS expectation that a canceled subscription keeps access through the period already paid for, and can be un-canceled any time before it lapses.

**Payment method changes use a SetupIntent, never a live charge.** `startPaymentMethodSetupAction` creates a Stripe SetupIntent; `PaymentMethodForm` mounts the Payment Element in `mode: setup`; `/billing/payment-method/return` (a Route Handler, not a page — matching the convention every OAuth callback in this app already follows for "a real write triggered by a provider redirect") reads the completed SetupIntent's payment method via `retrieveSetupIntentPaymentMethod` and calls `attachDefaultPaymentMethod`. The same flow serves three different subscription states (trialing customer adding a card before conversion, past-due customer fixing a declined card, any customer updating their card) because attaching a default payment method is the same operation regardless of why.

**A stuck `incomplete` subscription gets its own recovery path, not the payment-method flow.** Attaching a new default payment method to a customer does not retry an existing unpaid invoice — Stripe requires either confirming the original PaymentIntent or a separate retry. `retrieveIncompleteSubscriptionClientSecret` re-fetches the same still-unpaid invoice's client secret so `RetryPaymentForm` can reopen the exact Payment Element confirmation flow checkout originally used, against the same subscription — never creating a second, duplicate one.

**Plan changes always show Stripe's real prorated amount before committing.** `previewPlanChangeAction` calls Stripe's preview-invoice endpoint and returns the actual `amountDueCents`; `ChangePlanForm` shows a charge-or-credit line and requires a second, explicit confirm click before `changePlanAction` runs the real proration.

**Capacity add-ons are on/off, not quantity-adjustable.** `ManageAddonForm` shows each enabled `plan_addons` SKU (e.g. "+5 active connections") as owned or not; `addAddonAction`/`removeAddonAction` add or remove exactly one subscription item with real proration via `addSubscriptionAddonItem`/`removeSubscriptionAddonItem`. A quantity stepper was deliberately not built — the two SKUs that exist don't need one yet, and adding one now would be speculative.

**Every mutating action is rate-limited per organization.** `checkRateLimit(`<action>:${organizationId}`, 10, 60 * 60 * 1000)` guards cancel, resume, payment-method setup, plan change, and add-on changes — matching the rate limiting every OAuth callback already had, closed here after an audit found the billing actions were the one place it was missing.

## Explicitly out of scope

Invoice/receipt history (Stripe's customer portal or hosted invoices are not linked from this app yet). Team/seat management beyond the numeric `usersLimit` entitlement. Downgrade guardrails that check whether the org is currently over the new plan's limits before allowing the switch — `previewPlanChangeAction` shows the price impact only, not a usage-fit check.

## Consequences

Every billing capability this app has is reachable from one page with no dead ends — a customer in any subscription status has exactly one clear next action. The next new billing capability (invoices, seats, a resubscribe path) should extend this same "gate by status, one action per state" pattern rather than introducing a second billing surface.
