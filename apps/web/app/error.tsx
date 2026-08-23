"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * The one error boundary for every page under the root layout. Without
 * this file, an uncaught error anywhere fell through to Next's bare
 * built-in error page — no brand, no way back to Today, and (outside
 * local dev) no explanation at all. `error.message`/`error.stack` are
 * deliberately never rendered: Next already strips them for a Server
 * Component error in production, but a Client Component error's message
 * passes through unredacted, so treating both the same here is the only
 * way to avoid occasionally leaking one.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="shell appPage" id="main-content">
      <section className="errorState" aria-labelledby="error-heading">
        <span className="errorIcon" aria-hidden="true">
          !
        </span>
        <div>
          <h1 id="error-heading">Something went wrong on this page</h1>
          <p>
            Nothing was changed or lost — your data is exactly as it was. This
            page just failed to load. Trying again usually fixes it.
          </p>
          <div className="errorActions">
            <button onClick={() => reset()} type="button">
              Try again
            </button>
            <Link href="/">Go to Today</Link>
          </div>
          {error.digest ? (
            <p className="errorReference">
              Reference: <code>{error.digest}</code>. See{" "}
              <Link href="/support">Support</Link> for how to reach us.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
