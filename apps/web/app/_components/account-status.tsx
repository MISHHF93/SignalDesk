import Link from "next/link";

import { signOutAction } from "../_actions/auth";
import type { CurrentSession } from "../_lib/session";

/**
 * Real, session-derived account status shown in the persistent header on
 * every page — honest everywhere, not just on `/`: whether you're signed
 * in is a fact about you, not about which page you're viewing. `session`
 * is resolved once in the layout and shared with `SiteNavigation`, rather
 * than each component re-querying it separately.
 */
export function AccountStatus({ session }: { session: CurrentSession | null }) {
  if (!session) {
    return (
      <div className="headerStatus" aria-label="Account status">
        <span className="statusSignal statusSignalMuted" aria-hidden="true" />
        <span>
          <strong>Not signed in</strong>
          <span>
            <Link href="/login">Sign in</Link>
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="headerStatus" aria-label="Account status">
      <span className="statusSignal" aria-hidden="true" />
      <span>
        <strong>{session.isAnonymous ? "Guest" : session.email}</strong>
        <form action={signOutAction}>
          <button type="submit" className="signOutButton">
            Sign out
          </button>
        </form>
      </span>
    </div>
  );
}
