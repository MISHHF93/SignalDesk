import { Drawer } from "../../../_components/drawer";
import { TicketDetailContent } from "../../../tickets/[id]/ticket-detail-content";

/**
 * Intercepts a same-level `<Link href="/tickets/{id}">` click from `/`
 * (the `(.)` convention — "intercept a segment at this level," matching
 * the root `@modal` slot's own level) and renders the ticket detail as a
 * drawer instead of a full page navigation — the command center stays
 * mounted and visible behind it. A direct visit never engages this file
 * at all; `tickets/[id]/page.tsx` stays the real, complete page for that.
 */
export default async function TicketDetailModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Drawer title="Support ticket">
      <TicketDetailContent ticketId={id} />
    </Drawer>
  );
}
