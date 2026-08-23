/**
 * The one loading skeleton for the whole app (Next.js only resolves the
 * nearest ancestor `loading.tsx` during a route transition, and this is
 * the only one that exists — see the doc comment on why per-route
 * skeletons aren't built yet). Shaped like `.shell .appPage` +
 * `.pageHero`, the structure every page *except* Today
 * (`.dashboard`/`.welcome`) actually uses — deliberately generic rather
 * than shaped like any one page's exact content, so it reads as
 * plausible loading UI regardless of which page a navigation is headed
 * to, instead of visibly flashing the wrong page's shape (found live,
 * under throttled network, navigating from Today to Integrations: the
 * previous Today-shaped version stayed on screen showing three
 * dashboard-card skeletons while the URL had already changed to
 * Integrations).
 */
export default function Loading() {
  return (
    <main className="shell appPage" id="main-content" aria-busy="true">
      <section className="pageHero" aria-label="Loading">
        <div>
          <div className="skeletonLine skeletonLine-kicker" />
          <div className="skeletonLine skeletonLine-heading" />
          <div className="skeletonLine skeletonLine-copy" />
        </div>
      </section>

      <div className="dynamicCardStack" aria-hidden="true">
        <div className="skeletonCard" />
        <div className="skeletonCard" />
        <div className="skeletonCard" />
      </div>
    </main>
  );
}
