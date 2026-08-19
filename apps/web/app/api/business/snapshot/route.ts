import { NextResponse } from "next/server";

import { getBusinessSnapshot } from "../../../_lib/business-snapshot";
import { getCurrentOrganization } from "../../../_lib/session";

/**
 * The first `app/api` route in this app — every other real write so far
 * has been a Server Action, and every other real read has been a Server
 * Component fetching directly. This exists for client-side consumers
 * (`useBusinessSnapshot`) that need to re-fetch the snapshot without a
 * full page reload; `page.tsx`'s own initial render calls
 * `getBusinessSnapshot` directly rather than round-tripping through this
 * route, since a Server Component calling its own API route over HTTP
 * would only add latency for no benefit.
 */
export async function GET() {
  const session = await getCurrentOrganization();

  if (!session) {
    return NextResponse.json({ error: "Sign in to do this." }, { status: 401 });
  }

  const snapshot = await getBusinessSnapshot(session, new Date());

  return NextResponse.json(snapshot);
}
