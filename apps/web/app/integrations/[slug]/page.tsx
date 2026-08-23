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
        description: `Review the planned ${connector.name} connector capabilities and implementation gates.`,
      }
    : { title: "Integration not found" };
}

/**
 * The canonical destination for a direct visit — an OAuth callback redirect,
 * a bookmarked/shared link, or a page refresh — none of which are a
 * client-side `<Link>` navigation from `/integrations`, so none of them are
 * eligible for the `@modal/(.)[slug]` intercepting route below. Clicking a
 * connector card from the list itself opens that drawer instead of this full
 * page (see `IntegrationExplorer`'s plain `<Link>`, which Next.js's routing
 * intercepts automatically); this route is what that drawer's "open full
 * page" fallback and every non-in-app entry point still land on.
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
