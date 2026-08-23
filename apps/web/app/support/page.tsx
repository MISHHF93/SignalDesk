import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  description: "There's no live, monitored support channel yet.",
};

/**
 * Honest, not a working contact path — see CLAUDE.md's honesty discipline
 * ("no button, control, or UI state may imply a backend process that
 * doesn't exist"). No support email, ticketing system, or SLA has been set
 * up for this product yet, so this page says that plainly to whoever
 * lands here rather than either fabricating a contact address nobody
 * monitors or exposing the internal decision this still needs (owner
 * inbox, tooling, response-time target) as if it were the visitor's
 * problem to track.
 */
export default function SupportPage() {
  return (
    <main className="shell appPage" id="main-content">
      <section className="pageHero" aria-labelledby="support-heading">
        <div>
          <p className="sectionKicker">Support</p>
          <h1 id="support-heading">Get help</h1>
          <p>
            There&rsquo;s no live, monitored support channel for SignalDesk yet
            — a message sent from here wouldn&rsquo;t reach anyone right now. We
            know that&rsquo;s not much help if you&rsquo;re stuck; we&rsquo;re
            working on it.
          </p>
        </div>
      </section>
    </main>
  );
}
