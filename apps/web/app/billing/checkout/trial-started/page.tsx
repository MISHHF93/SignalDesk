import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Trial started" };

export default function TrialStartedPage() {
  return (
    <main className="shell appPage" id="main-content">
      <section className="pageHero" aria-labelledby="trial-started-heading">
        <div>
          <p className="sectionKicker">Business — 14-day trial</p>
          <h1 id="trial-started-heading">You&rsquo;re in.</h1>
          <p>
            Your trial runs for 14 days with no card required. Add a payment
            method before it ends to keep access — without one, Stripe cancels
            the trial automatically rather than charging you unexpectedly.
          </p>
        </div>
      </section>
      <Link className="btn btn-primary" href="/">
        Go to your command center
      </Link>
    </main>
  );
}
