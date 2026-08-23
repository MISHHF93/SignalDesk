import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Placeholder Terms of Service — pending legal review.",
};

/**
 * A structured checklist for real legal drafting, not a real Terms of
 * Service — see CLAUDE.md's honesty discipline ("no fabricated legal
 * claims... requiring explicit owner/legal review"). Every section below
 * names what a real ToS for this specific app would need to cover, given
 * its actual architecture (multi-tenant orgs, connector OAuth grants,
 * AI-provider usage, Stripe billing) — a grounded starting point for
 * counsel, not boilerplate to publish as-is.
 */
export default function TermsOfServicePage() {
  return (
    <main className="shell appPage" id="main-content">
      <section className="pageHero" aria-labelledby="terms-heading">
        <div>
          <p className="sectionKicker">Legal</p>
          <h1 id="terms-heading">Terms of Service</h1>
          <p>
            This page is a structured placeholder, not a published legal
            document. Nothing below has been reviewed or approved by counsel —
            it exists so a real Terms of Service can be drafted against this
            app&rsquo;s actual behavior instead of generic boilerplate.
          </p>
        </div>
      </section>

      <aside className="honestyNotice" aria-labelledby="terms-notice-heading">
        <span className="noticeIcon" aria-hidden="true">
          ↔
        </span>
        <div>
          <h2 id="terms-notice-heading">Requires owner/legal review</h2>
          <p>
            No section on this page is a binding term. Do not rely on this page
            for any real user agreement until a qualified reviewer has replaced
            it with reviewed legal text.
          </p>
        </div>
      </aside>

      <section className="connectorOverview" aria-labelledby="sections-heading">
        <div className="detailSectionHeading">
          <p className="sectionKicker">Drafting checklist</p>
          <h2 id="sections-heading">
            What a real Terms of Service needs to cover here
          </h2>
        </div>

        <div className="capabilityGrid">
          <article className="capabilityCard">
            <h3>Account &amp; organization structure</h3>
            <p>
              One signed-in user provisions one organization (or accepts an
              invite into an existing one); roles are owner/admin/member/
              viewer. Terms should define who can bind the organization, who can
              delete it, and what happens to connected data on deletion.
            </p>
          </article>
          <article className="capabilityCard">
            <h3>Connector data access</h3>
            <p>
              Connecting a third-party tool (Gmail, HubSpot, QuickBooks,
              Salesforce, Slack, Xero, Jira, Zendesk, and others) grants this
              app read (and, for a small number of future actions, governed
              write) access via OAuth. Terms should disclose exactly what scopes
              are requested per connector and that access is revocable at any
              time from the Integrations page.
            </p>
          </article>
          <article className="capabilityCard">
            <h3>AI-provider usage</h3>
            <p>
              Investigation requests may be sent to Anthropic&rsquo;s Claude API
              (the platform&rsquo;s own key, or an organization&rsquo;s own
              bring-your-own key). Terms should disclose this, that no AI action
              executes a business mutation without explicit human approval, and
              what data leaves this app&rsquo;s infrastructure as a result.
            </p>
          </article>
          <article className="capabilityCard">
            <h3>Billing &amp; subscriptions</h3>
            <p>
              Real Stripe-backed subscriptions, upgrades/downgrades,
              cancellation, and failed-payment handling exist today. Terms
              should cover billing cycles, refund policy, and what happens to
              data access when a subscription lapses or is canceled.
            </p>
          </article>
          <article className="capabilityCard">
            <h3>Acceptable use</h3>
            <p>
              Standard prohibited-use language (no unauthorized access attempts,
              no reverse engineering of the connector/action safety gates, no
              abuse of the AI investigation pipeline) — not yet drafted.
            </p>
          </article>
          <article className="capabilityCard">
            <h3>Liability &amp; disclaimers</h3>
            <p>
              Standard limitation-of-liability, warranty disclaimer, and
              indemnification language for a B2B SaaS product — not yet drafted;
              requires counsel familiar with the jurisdiction(s) this product
              will actually operate in.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
