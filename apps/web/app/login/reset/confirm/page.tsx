import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentOrganization } from "../../../_lib/session";
import { ConfirmResetForm } from "./confirm-form";

export const metadata: Metadata = {
  title: "Set a new password",
};

/**
 * Only reachable with a real, active session — which for this page means
 * a real recovery session established by following an actual reset-email
 * link (see `requestPasswordResetAction`'s doc comment for the exact
 * mechanism). No session means the link was never followed, already used,
 * or expired — shown honestly rather than rendering a form that would
 * just fail on submit.
 */
export default async function ConfirmResetPage() {
  const session = await getCurrentOrganization();

  return (
    <main className="shell authShell" id="main-content">
      <section className="authCard" aria-labelledby="confirm-heading">
        <p className="sectionKicker">Business command center</p>
        <h1 id="confirm-heading">Set a new password</h1>
        {session ? (
          <ConfirmResetForm />
        ) : (
          <>
            <p className="authError" role="alert">
              This reset link is invalid or has expired.
            </p>
            <p className="authSwitch">
              <Link href="/login/reset">Request a new link</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
