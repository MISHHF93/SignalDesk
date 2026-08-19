import {
  createDatabasePool,
  resolveOrganizationForIdentity,
  type DatabasePool,
} from "@signaldesk/persistence";
import { cache } from "react";

import { createClient } from "../../lib/supabase/server";

export interface CurrentSession {
  readonly organizationId: string;
  readonly userId: string;
  readonly role: string;
  readonly email: string | null;
  readonly isAnonymous: boolean;
}

// Module-scoped so the pool is reused across invocations within one server
// process rather than opened per request (matches the existing
// create-internal-task action's pattern).
let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * The Data Access Layer every real Server Component and Server Action must
 * call itself to determine the caller's tenant — never accept an
 * organization id as an argument. Uses `getClaims()`, which verifies the
 * JWT locally, not `getSession()`, which does not (Supabase's own guidance:
 * "use getClaims to verify identity"). proxy.ts already redirects an
 * unauthenticated visit to `/`, but this is the real authorization
 * boundary — proxy coverage can silently drop if a matcher changes.
 *
 * Wrapped in React's `cache()` (Next.js's own documented DAL pattern) so
 * that calling this from both the root layout and the page it wraps —
 * which every route here does — costs one JWT check and one DB round-trip
 * per request, not two. Safe because `cache()` memoizes per request, not
 * across requests: nothing here is stale after the response is sent.
 */
export const getCurrentOrganization = cache(
  async (): Promise<CurrentSession | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data?.claims) {
      return null;
    }

    const { sub, email, is_anonymous } = data.claims;

    if (!sub) {
      return null;
    }

    const membership = await resolveOrganizationForIdentity(
      getPool(),
      "supabase",
      sub,
    );

    if (!membership) {
      return null;
    }

    return {
      organizationId: membership.organizationId,
      userId: membership.userId,
      role: membership.role,
      email: typeof email === "string" ? email : null,
      isAnonymous: is_anonymous === true,
    };
  },
);
