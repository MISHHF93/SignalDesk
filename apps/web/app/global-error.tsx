"use client";

/**
 * Only activates when the root layout itself throws (so rare it has
 * never happened in this app) — Next requires this file to render its
 * own <html>/<body>, since it replaces the layout that would normally
 * provide them. No import of globals.css or any app component: if the
 * layout failed, those may be exactly what's broken, so this stays
 * inline and self-contained on purpose.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          background: "#05070a",
          color: "#eef3f4",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center", padding: "1.5rem" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            SignalDesk couldn&rsquo;t load
          </h1>
          <p style={{ color: "#93a1ab", marginBottom: "1.25rem" }}>
            Nothing was changed or lost. Reloading usually fixes this.
          </p>
          <button
            onClick={() => reset()}
            type="button"
            style={{
              background: "#eef3f4",
              color: "#05070a",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.6rem 1.2rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
