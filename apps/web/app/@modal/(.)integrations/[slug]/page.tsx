import { getConnectorBySlug } from "@signaldesk/integrations";
import { notFound } from "next/navigation";

import { Drawer } from "../../../_components/drawer";
import { ConnectorDetailContent } from "../../../integrations/[slug]/connector-detail-content";

/**
 * Intercepts a `<Link href="/integrations/{slug}">` click from anywhere in
 * the app (root `@modal`, same convention as `(.)tickets/[id]` — "intercept
 * a segment at this level," matching root's own level) and renders the
 * connector detail as a drawer instead of a full page navigation. Moved
 * here from a slot nested under `/integrations` (2026-08-23, a deep audit
 * of "unjustified isolation"): that nested slot only intercepted a click
 * that originated from inside `/integrations` itself, so the identical
 * `<Link href="/integrations/${connector.slug}">` on
 * `integration-health-card.tsx` — rendered on the Today page, a brand-new
 * user's most likely first "connect a tool" click — silently fell through
 * to a real, full-page navigation instead, even though the exact same
 * destination correctly opened as a drawer from `/integrations`. A direct
 * visit (OAuth callback redirect, refresh, shared link) never goes through
 * this file at all — Next.js only engages an intercepting route for an
 * in-app soft navigation — so `integrations/[slug]/page.tsx` stays the
 * real, complete page for every one of those, unchanged.
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
