"use client";

import Link from "next/link";
import { useState } from "react";

import type { PlanCatalogEntry } from "@signaldesk/persistence";

const CAPABILITY_LABELS: Record<string, string> = {
  actionPreparation: "Action preparation",
  approvals: "Approval workflows",
  delegatedAutomation: "Delegated automation",
  advancedPolicies: "Advanced policies",
  governanceControls: "Governance controls",
  enterpriseIdentity: "Enterprise identity & SSO",
  customConnectors: "Custom connectors",
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
}

export function PricingTable({
  plans,
}: {
  readonly plans: readonly PlanCatalogEntry[];
}) {
  const [interval, setInterval] = useState<"month" | "year">("month");

  return (
    <section className="pricingSection" aria-labelledby="pricing-plans-heading">
      <div className="pricingToggle" role="group" aria-label="Billing interval">
        <button
          type="button"
          className={interval === "month" ? "pricingToggleActive" : ""}
          aria-pressed={interval === "month"}
          onClick={() => setInterval("month")}
        >
          Monthly
        </button>
        <button
          type="button"
          className={interval === "year" ? "pricingToggleActive" : ""}
          aria-pressed={interval === "year"}
          onClick={() => setInterval("year")}
        >
          Annual — 2 months free
        </button>
      </div>

      <h2 id="pricing-plans-heading" className="visuallyHidden">
        Plans
      </h2>

      <div className="pricingGrid">
        {plans.map((plan) => {
          const priceCents =
            interval === "month"
              ? plan.monthlyPriceCents
              : plan.annualPriceCents;
          const capabilities = Object.entries(plan.capabilityFlags).filter(
            ([, enabled]) => enabled,
          );

          return (
            <article
              key={plan.planKey}
              className={
                plan.isRecommended
                  ? "pricingCard pricingCardRecommended"
                  : "pricingCard"
              }
            >
              {plan.isRecommended ? (
                <p className="pricingBadge">Recommended</p>
              ) : null}

              <h3>{plan.name}</h3>

              <p className="pricingAmount">
                {plan.isCustomPricing
                  ? "Custom"
                  : priceCents !== null
                    ? `${formatCents(priceCents)}/${interval === "month" ? "mo" : "yr"}`
                    : "Not available"}
              </p>

              <p className="pricingSummary">{plan.differentiationSummary}</p>

              <dl className="pricingLimits">
                <div>
                  <dt>Users</dt>
                  <dd>{plan.includedUsers ?? "Negotiated"}</dd>
                </div>
                <div>
                  <dt>Active connections</dt>
                  <dd>{plan.includedActiveConnections ?? "Negotiated"}</dd>
                </div>
              </dl>

              {capabilities.length > 0 ? (
                <ul className="pricingCapabilities">
                  {capabilities.map(([key]) => (
                    <li key={key}>{CAPABILITY_LABELS[key] ?? key}</li>
                  ))}
                </ul>
              ) : null}

              {plan.isCustomPricing ? (
                <p className="pricingContact">
                  Contact us for Enterprise pricing.
                </p>
              ) : plan.supportsSelfServeCheckout ? (
                <Link
                  className="btn btn-primary"
                  href={`/billing/checkout/${plan.planKey}?interval=${interval}`}
                >
                  {plan.planKey === "business"
                    ? "Start free trial"
                    : "Subscribe"}
                </Link>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
