import { NextResponse } from "next/server";

import { createClient } from "../../../lib/supabase/server";
import { safeNextPath } from "../../_lib/safe-next-path";

/**
 * Completes the OAuth PKCE flow started by `signInWithOAuthAction`:
 * exchanges the provider's authorization code for a real Supabase session,
 * setting the session cookies via `createClient()`'s cookie adapter.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
