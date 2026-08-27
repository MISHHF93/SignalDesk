import { NextResponse } from "next/server";

import { createDatabasePool, type DatabasePool } from "@signaldesk/persistence";

import { createClient } from "../../../lib/supabase/server";
import { checkRateLimit, getClientIp } from "../../_lib/rate-limit";
import { safeNextPath } from "../../_lib/safe-next-path";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Completes the OAuth PKCE flow started by `signInWithOAuthAction`:
 * exchanges the provider's authorization code for a real Supabase session,
 * setting the session cookies via `createClient()`'s cookie adapter.
 *
 * Real gap found by review: this had no rate limit at all, unlike every
 * direct sibling — `signInAction`/`signUpAction`/`requestPasswordResetAction`
 * (`_actions/auth.ts`, all IP-keyed) and all 14 connector OAuth callback
 * routes (e.g. `integrations/hubspot/callback/route.ts`, 20/hour per IP) —
 * despite calling `exchangeCodeForSession`, a real network call to
 * Supabase Auth with a client-supplied `code`. Matched to the connector
 * callbacks' own bound and IP key, the closer sibling shape (a public,
 * pre-session OAuth redirect target, not a form submission).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const rateLimit = await checkRateLimit(
    getPool(),
    `auth-callback:${await getClientIp()}`,
    20,
    60 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
