import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell appPage" id="main-content">
      <section
        className="errorState notFoundState"
        aria-labelledby="not-found-heading"
      >
        <span className="errorIcon" aria-hidden="true">
          ?
        </span>
        <div>
          <h1 id="not-found-heading">Page not found</h1>
          <p>
            There&rsquo;s nothing at this address. It may have moved, or the
            link may be out of date.
          </p>
          <div className="errorActions">
            <Link href="/">Go to Today</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
