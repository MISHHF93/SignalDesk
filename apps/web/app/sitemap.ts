import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

// Only the routes robots.ts also allows — every other real route requires
// a session and has nothing to offer a crawler.
const PUBLIC_ROUTES: readonly { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/pricing", priority: 0.9 },
  { path: "/login", priority: 0.5 },
  { path: "/signup", priority: 0.5 },
  { path: "/legal/terms", priority: 0.2 },
  { path: "/legal/privacy", priority: 0.2 },
  { path: "/support", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map(({ path, priority }) => ({
    url: `${APP_URL}${path}`,
    lastModified: new Date(),
    priority,
  }));
}
