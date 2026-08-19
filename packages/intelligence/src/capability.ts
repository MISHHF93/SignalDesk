import type { Invoice, Lead, Task } from "@business-dashboard/domain";

import type { IntelligenceFinding } from "./finding";

/**
 * What a capability needs to evaluate. Deliberately narrow and honest about
 * today's single-lead reality rather than a speculative multi-entity shape
 * nothing can populate yet — widen this as real data sources are added.
 * `lead` is `null` for a real organization with no connected data source
 * yet (there is no synthetic fallback); lead-dependent capabilities must
 * treat that as "nothing to evaluate," not an error.
 *
 * `overdueInvoices` is the real widening this type's own doc comment
 * anticipated: unlike `lead` (one representative record), invoices are
 * independent risk items, so this is every currently-overdue invoice
 * worth surfacing (`listOverdueInvoices`, `@business-dashboard/persistence`),
 * not just one. An empty array means either no invoices exist yet or none
 * are currently overdue — both read the same to a capability.
 *
 * `connectedIntegrationSlugs` names every connector (by catalog `slug`)
 * with a real, active connection for this organization — the caller reads
 * this from `integrations.status` before constructing the context, since
 * capabilities never touch the database themselves. This is what lets
 * `integration-health` report real state instead of assuming nothing is
 * ever connected.
 *
 * `highValueThresholdCents` is the organization's own configured
 * "critical vs. high" severity boundary
 * (`OrganizationBusinessProfile.highValueThresholdCents`,
 * `@business-dashboard/persistence`) — never a hardcoded platform-wide
 * constant, since what counts as high-value differs by business.
 *
 * `workingDaysBitmask`/`timeZone` are the organization's own configured
 * working days (`OrganizationBusinessProfile.workingDaysBitmask`) and
 * timezone — capabilities that measure elapsed time must use these rather
 * than raw wall-clock hours, so a lead created just before a weekend or
 * holiday doesn't read as neglected before the business was ever actually
 * open to respond to it.
 */
export interface IntelligenceContext {
  readonly now: Date;
  readonly lead: Lead | null;
  readonly overdueInvoices: readonly Invoice[];
  /** Every currently-overdue, incomplete task assigned to the connected
   * Asana user (`listOverdueTasks`, `@business-dashboard/persistence`) —
   * the Delivery-domain counterpart to `overdueInvoices`, same "real set,
   * not one representative record" shape. */
  readonly overdueTasks: readonly Task[];
  readonly connectedIntegrationSlugs: readonly string[];
  readonly highValueThresholdCents: number;
  readonly workingDaysBitmask: number;
  readonly timeZone: string;
}

/**
 * A bounded, named unit of detection logic — the Intelligence Core's unit
 * of composition. Capabilities are services the AI Business Node calls, not
 * independent agents; they never decide dashboard layout or final priority.
 */
export interface IntelligenceCapability {
  readonly id: string;
  readonly description: string;
  evaluate(
    context: IntelligenceContext,
  ): Promise<readonly IntelligenceFinding[]>;
}
