import { Drawer } from "../../../_components/drawer";

/**
 * Same gap, same fix as the connector drawer's own `loading.tsx`
 * (`@modal/(.)integrations/[slug]/loading.tsx` — see its doc comment):
 * without this, clicking a ticket card showed nothing for a couple of
 * seconds on a slow connection. `Drawer`'s title here is already
 * static ("Support ticket," matching the real page), so no placeholder
 * is needed the way the connector drawer needed one.
 */
export default function TicketDetailModalLoading() {
  return (
    <Drawer title="Support ticket">
      <div aria-busy="true">
        <div className="badgeRow connectorDetailBadges">
          <div
            className="skeletonLine"
            style={{ width: "4rem", height: "1.4rem", marginBottom: 0 }}
          />
          <div
            className="skeletonLine"
            style={{ width: "3rem", height: "1.4rem", marginBottom: 0 }}
          />
        </div>
        <div className="skeletonLine skeletonLine-heading" />
        <div className="skeletonCard" style={{ marginTop: "1.5rem" }} />
      </div>
    </Drawer>
  );
}
