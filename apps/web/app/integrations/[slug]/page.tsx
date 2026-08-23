import { connectorCatalog, getConnectorBySlug } from "@signaldesk/integrations";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConnectorDetailContent } from "./connector-detail-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return connectorCatalog.map((connector) => ({ slug: connector.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const connector = getConnectorBySlug(slug);

  return connector
    ? {
        title: `${connector.name} integration`,
        description: `Connect ${connector.name} to SignalDesk, and see what it can do today.`,
      }
    : { title: "Integration not found" };
}

/**
 * The canonical destination for a direct visit — an OAuth callback redirect,
 * a bookmarked/shared link, or a page refresh — none of which are a
 * client-side `<Link>` navigation, so none of them are eligible for the
 * intercepting route (`@modal/(.)integrations/[slug]/page.tsx`, root level,
 * matching `(.)tickets/[id]`). Any real in-app `<Link href="/integrations/
 * {slug}">` click — from the `/integrations` list itself
 * (`IntegrationExplorer`) or from a Today card (`integration-health-card.tsx`)
 * — opens that drawer instead of this full page, since the interception now
 * lives at the same root level both entry points share (moved here
 * 2026-08-23; a nested slot under `/integrations` only covered the first of
 * those two). This route is what that drawer's "open full page" fallback and
 * every non-in-app entry point still land on.
 */
export default async function IntegrationDetailPage({
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
    <main className="shell appPage connectorDetailPage" id="main-content">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/integrations">Integrations</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{connector.name}</span>
      </nav>

      <ConnectorDetailContent slug={slug} rawSearchParams={rawSearchParams} />
    </main>
  );
}
