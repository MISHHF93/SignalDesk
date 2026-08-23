import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Placeholder Privacy Policy — pending legal review.",
};

/**
 * A structured checklist for real legal drafting, not a real Privacy
 * Policy — see CLAUDE.md's honesty discipline. Grounded in this app's
 * actual data handling (what's real today, not aspirational), so counsel
 * drafts against real behavior rather than generic boilerplate.
 */
export default function PrivacyPolicyPage() {
  return (
    <main className="shell appPage" id="main-content">
      <section className="pageHero" aria-labelledby="privacy-heading">
        <div>
          <p className="sectionKicker">Legal</p>
          <h1 id="privacy-heading">Privacy Policy</h1>
          <p>
            This page is a structured placeholder, not a published legal
            document. Nothing below has been reviewed or approved by counsel or
            a privacy officer.
          </p>
        </div>
      </section>

      <aside className="honestyNotice" aria-labelledby="privacy-notice-heading">
        <span className="noticeIcon" aria-hidden="true">
          ↔
        </span>
        <div>
          <h2 id="privacy-notice-heading">Requires owner/legal review</h2>
          <p>
            Do not rely on this page as a real privacy disclosure until a
            qualified reviewer has replaced it with reviewed text, including a
            real determination of which data-protection regimes
            (GDPR/CCPA/others) apply to this product&rsquo;s actual customers.
          </p>
        </div>
      </aside>

      <section className="connectorOverview" aria-labelledby="sections-heading">
        <div className="detailSectionHeading">
          <p className="sectionKicker">Drafting checklist</p>
          <h2 id="sections-heading">
            What a real Privacy Policy needs to cover here
          </h2>
        </div>

        <div className="capabilityGrid">
          <article className="capabilityCard">
            <h3>Data collected directly</h3>
            <p>
              Account email, organization name/industry, and any business data
              manually entered (goals, CSV-imported invoices, manually created
              tasks).
            </p>
          </article>
          <article className="capabilityCard">
            <h3>Data collected via connectors</h3>
            <p>
              Whatever scope a connected provider grants — CRM deals/
              opportunities, invoices, tasks/issues, calendar events, and (Gmail
              only) message subject/snippet/a truncated body preview of external
              correspondence. Every connected record retains its real source
              system, timestamp, and an integrity digest (the Business
              Graph&rsquo;s own provenance model) — a real, verifiable answer to
              &ldquo;where did this come from,&rdquo; not a policy claim.
            </p>
          </article>
          <article className="capabilityCard">
            <h3>Retention &amp; deletion</h3>
            <p>
              Deleting an organization (Profile → Delete organization)
              disconnects every connected integration, cancels any active
              subscription, and anonymizes the organization&rsquo;s record — a
              real, tested flow today. A dedicated, policy-driven retention
              schedule (e.g. auto-expiring Gmail message previews after N days)
              has a plumbed field (<code>messages.retain_until</code>) but no
              enforcement job yet — this gap must be disclosed honestly, not
              implied as already enforced.
            </p>
          </article>
          <article className="capabilityCard">
            <h3>Subprocessors</h3>
            <p>
              Real infrastructure subprocessors today: Supabase (database and
              auth), Vercel (hosting), Stripe (billing), Anthropic (AI
              investigation, when configured), Resend (transactional email, when
              configured). A real subprocessor list with purpose/data-category
              per vendor still needs to be drafted and kept current as vendors
              change.
            </p>
          </article>
          <article className="capabilityCard">
            <h3>AI-provider disclosure</h3>
            <p>
              When an investigation is triggered, business evidence (never raw
              connector payloads — only the deterministic findings and their
              evidence fields) is sent to Anthropic&rsquo;s Claude API.
              Organizations may configure their own Anthropic key instead of the
              platform&rsquo;s. No AI output executes a mutation without a human
              approving a proposed action first.
            </p>
          </article>
          <article className="capabilityCard">
            <h3>Data export &amp; portability</h3>
            <p>
              A real data-export flow exists at <code>/profile/export</code> —
              verify its actual current scope against this checklist before
              publishing any claim about what it covers.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
