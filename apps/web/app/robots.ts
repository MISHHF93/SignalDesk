import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

/**
 * Only the real, public marketing/legal surface is crawlable — everything
 * else in this app requires a real session (RLS-scoped data, per-tenant
 * routes), so there is nothing for a crawler to legitimately index there.
 * `/api` is disallowed outright: no route under it is meant for a browser
 * user agent, and several are webhook/cron endpoints that should never
 * appear in a search index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/legal/terms", "/legal/privacy", "/support"],
      disallow: [
        "/api/",
        "/integrations",
        "/billing",
        "/profile",
        "/agents",
        "/briefs",
        "/trust",
        "/tickets/",
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
