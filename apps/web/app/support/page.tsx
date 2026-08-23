import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  description: "Support contact placeholder — pending owner decision.",
};

/**
 * A placeholder, not a real support channel — see CLAUDE.md's honesty
 * discipline ("no button, control, or UI state may imply a backend process
 * that doesn't exist"). No support email, ticketing system, or SLA has
 * been decided for this product yet; this page names what needs deciding
 * rather than inventing a contact address nobody is monitoring.
 */
export default function SupportPage() {
  return (
    <main className="shell appPage" id="main-content">
      <section className="pageHero" aria-labelledby="support-heading">
        <div>
          <p className="sectionKicker">Support</p>
          <h1 id="support-heading">Get help</h1>
          <p>
            This product does not yet have a real, monitored support channel.
            This page is a placeholder naming what needs to be decided before
            launch, not a working contact path.
          </p>
        </div>
      </section>

      <aside className="honestyNotice" aria-labelledby="support-notice-heading">
        <span className="noticeIcon" aria-hidden="true">
          ↔
        </span>
        <div>
          <h2 id="support-notice-heading">Business decision required</h2>
          <p>
            Before this page can honestly offer a way to reach support, the
            product owner needs to decide: a real monitored inbox address (and
            who monitors it), whether a ticketing tool (e.g. Zendesk — already a
            real connector in this app&rsquo;s own catalog, coincidentally) is
            worth adopting for support itself, and what response-time
            expectation, if any, to publish.
          </p>
        </div>
      </aside>
    </main>
  );
}
