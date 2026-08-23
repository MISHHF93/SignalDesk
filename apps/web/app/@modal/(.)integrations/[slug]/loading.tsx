import { Drawer } from "../../../_components/drawer";

/**
 * Shown the instant a connector card is clicked, before this route's own
 * data has arrived — found missing by testing the real drawer under a
 * throttled connection: with no `loading.tsx` here, nothing at all
 * happened for the first couple of seconds after the click (no drawer,
 * no spinner, no feedback), which reads as an unresponsive click rather
 * than a loading one. Renders the real `Drawer` shell immediately (same
 * slide-in, same focus-trap, same Escape/backdrop close) with a
 * skeleton body instead of `ConnectorDetailContent` — `loading.tsx`
 * files don't receive the route's own params, so the real connector
 * name isn't known yet here; "Loading…" is the honest label for that.
 */
export default function ConnectorDetailModalLoading() {
  return (
    <Drawer title="Loading…">
      <div aria-busy="true">
        <div className="badgeRow connectorDetailBadges">
          <div
            className="skeletonLine"
            style={{ width: "5rem", height: "1.4rem", marginBottom: 0 }}
          />
        </div>
        <div className="skeletonLine skeletonLine-kicker" />
        <div className="skeletonLine skeletonLine-heading" />
        <div className="skeletonLine skeletonLine-copy" />
        <div className="skeletonCard" style={{ marginTop: "1.5rem" }} />
      </div>
    </Drawer>
  );
}
