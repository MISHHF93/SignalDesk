import type {
  Invoice,
  Lead,
  Message,
  Payment,
  SupportTicket,
  Task,
} from "@signaldesk/domain";
import type { Goal } from "@signaldesk/goals";
import type { MetricValue } from "@signaldesk/semantics";

import type { IntelligenceFinding } from "./finding";

/**
 * What a capability needs to evaluate.
 *
 * `leads` is every lead worth the Intelligence Core's attention today
 * (`listLeadsForAttention`, `@signaldesk/persistence`) — not just one.
 * This used to be a single `lead: Lead | null` field, a deliberate
 * stopgap whose own doc comment already called for widening once more
 * than one lead could be evaluated at a time; `lead-risk`/`ownership` now
 * both loop over this set instead of reading one representative record,
 * matching how `overdueInvoices` (below) already worked. An empty array
 * means either no leads exist yet or none from a currently `active`/
 * `degraded` source integration — both read the same to a capability.
 *
 * `overdueInvoices` is every currently-overdue invoice worth surfacing
 * (`listOverdueInvoices`, `@signaldesk/persistence`) — invoices are
 * independent risk items, so this is the real set, not just one. An
 * empty array means either no invoices exist yet or none are currently
 * overdue — both read the same to a capability.
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
 * `@signaldesk/persistence`) — never a hardcoded platform-wide
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
  readonly leads: readonly Lead[];
  readonly overdueInvoices: readonly Invoice[];
  /** Every currently-overdue, incomplete task assigned to the connected
   * Asana user (`listOverdueTasks`, `@signaldesk/persistence`) —
   * the Delivery-domain counterpart to `overdueInvoices`, same "real set,
   * not one representative record" shape. */
  readonly overdueTasks: readonly Task[];
  /** The most recent payments observed ("what came in" — one of the four
   * universal operating questions), independent of any risk condition:
   * unlike `overdueInvoices`/`overdueTasks`, a payment isn't a problem to
   * evaluate, just a fact worth surfacing (`listRecentPayments`,
   * `@signaldesk/persistence`). */
  readonly recentPayments: readonly Payment[];
  readonly connectedIntegrationSlugs: readonly string[];
  readonly highValueThresholdCents: number;
  readonly workingDaysBitmask: number;
  readonly timeZone: string;
  /** Every real goal the organization has defined (`listGoals`,
   * `@signaldesk/persistence`) — the Goal Intelligence Engine's own input
   * (Prompt 22, docs/product-vision-backlog.md, ADR 0035). Empty for an
   * organization that has never created one; not every capability reads
   * this. */
  readonly goals: readonly Goal[];
  /** Every thread whose latest message is a still-unanswered real inbound
   * one (`listUnansweredExternalMessages`, `@signaldesk/persistence`,
   * Phase 4b, implementation roadmap) — the same "real set, not one
   * representative record" shape as `overdueTasks`. Carries no message
   * body text (only `snippet`) — see `Message`'s own doc comment
   * (`@signaldesk/domain`) for why that's a structural guarantee, not a
   * convention. */
  readonly recentUnansweredMessages: readonly Message[];
  /** The organization's own configured response-time threshold
   * (`OrganizationBusinessProfile.defaultExpectedResponseHours`) — every
   * `Lead` already carries its own copy of this baked in at ingest time,
   * but a `Message` deliberately doesn't (no per-message threshold the
   * way a lead has its own), so `message-follow-up.ts` reads it from here
   * directly. */
  readonly defaultExpectedResponseHours: number;
  /** Every currently `new`/`open`/`pending` support ticket worth
   * surfacing as potentially stuck (`listStuckSupportTickets`,
   * `@signaldesk/persistence`) — the Customer-Operations-domain
   * counterpart to `overdueTasks`/`recentUnansweredMessages`, same "real
   * set, not one representative record" shape. Reuses
   * `defaultExpectedResponseHours` as its own threshold too — there is no
   * separate per-ticket response-time concept in this codebase, the same
   * way `message-follow-up.ts` reuses it rather than inventing one. */
  readonly stuckSupportTickets: readonly SupportTicket[];
  /** Every real Business Semantic Layer metric computed for this
   * organization this render (`computeBusinessMetrics`,
   * `@signaldesk/semantics`, ADR 0034) — what `goalVarianceIntelligence`
   * evaluates each goal against. */
  readonly businessMetrics: readonly MetricValue[];
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
