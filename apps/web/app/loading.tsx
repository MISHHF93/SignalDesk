export default function Loading() {
  return (
    <main className="shell dashboard" id="main-content" aria-busy="true">
      <section className="welcome" aria-label="Loading">
        <div>
          <div className="skeletonLine skeletonLine-date" />
          <div className="skeletonLine skeletonLine-heading" />
          <div className="skeletonLine skeletonLine-copy" />
        </div>
      </section>

      <section className="attentionSection">
        <div className="sectionHeading">
          <div>
            <div className="skeletonLine skeletonLine-kicker" />
            <div className="skeletonLine skeletonLine-subheading" />
          </div>
        </div>

        <div className="dynamicCardStack" aria-hidden="true">
          <div className="skeletonCard" />
          <div className="skeletonCard" />
          <div className="skeletonCard" />
        </div>
      </section>
    </main>
  );
}
