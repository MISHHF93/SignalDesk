import type { Metadata } from "next";
import Link from "next/link";

import { TicketDetailContent } from "./ticket-detail-content";

export const metadata: Metadata = {
  title: "Support ticket",
};

/**
 * The canonical destination for a direct visit — a shared link, a page
 * refresh — neither of which is a client-side `<Link>` navigation from
 * `/`, so neither is eligible for the `@modal/(.)tickets/[id]`
 * intercepting route (see that file's own doc comment). Clicking a
 * ticket-risk card's title from the command center opens that drawer
 * instead of this full page.
 */
export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="shell appPage connectorDetailPage" id="main-content">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Today</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Ticket</span>
      </nav>

      <TicketDetailContent ticketId={id} />
    </main>
  );
}
