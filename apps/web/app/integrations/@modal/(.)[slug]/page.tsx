import { getConnectorBySlug } from "@signaldesk/integrations";
import { notFound } from "next/navigation";

import { Drawer } from "../../../_components/drawer";
import { ConnectorDetailContent } from "../../[slug]/connector-detail-content";

/**
 * Intercepts a same-level `<Link href="/integrations/{slug}">` click from
 * `/integrations` (the `(.)` convention — "intercept a segment at this
 * level") and renders the connector detail as a drawer instead of a full
 * page navigation. A direct visit (OAuth callback redirect, refresh, shared
 * link) never goes through this file at all — Next.js only engages an
 * intercepting route for an in-app soft navigation — so `[slug]/page.tsx`
 * stays the real, complete page for every one of those, unchanged.
 */
export default async function ConnectorDetailModal({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const connector = getConnectorBySlug(slug);

  if (!connector) notFound();

  const rawSearchParams = await searchParams;

  return (
    <Drawer title={connector.name}>
      <ConnectorDetailContent slug={slug} rawSearchParams={rawSearchParams} />
    </Drawer>
  );
}
