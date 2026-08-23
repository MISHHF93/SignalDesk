import type { Metadata } from "next";

import { safeNextPath } from "../_lib/safe-next-path";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

const OAUTH_ERROR_MESSAGE =
  "Sign-in with that provider didn't complete. Please try again, or sign in with email and password.";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    error?: string;
    deleted?: string;
    reset?: string;
  }>;
}) {
  const { next: rawNext, error, deleted, reset } = await searchParams;
  const next = safeNextPath(rawNext);
  // Checks the sanitized value, not merely whether a `next` param was
  // present: `safeNextPath` falls back to exactly "/" for a missing OR
  // rejected value (e.g. an unsafe `next=//evil.example`), so this must
  // compare against that same fallback to avoid showing "Sign in to
  // continue" for a destination that's actually just the homepage.
  const cameFromProtectedPage = next !== "/";

  return (
    <main className="shell authShell" id="main-content">
      <section className="authCard" aria-labelledby="login-heading">
        <p className="sectionKicker">Business command center</p>
        <h1 id="login-heading">
          {cameFromProtectedPage ? "Sign in to continue" : "Sign in"}
        </h1>
        <p className="authCopy">
          {cameFromProtectedPage
            ? "Today shows your organization's real, live attention state — sign in to see it."
            : "Sign in to see your organization’s real, live attention state."}
        </p>
        {error === "oauth" ? (
          <p className="authError" role="alert">
            {OAUTH_ERROR_MESSAGE}
          </p>
        ) : null}
        {deleted === "1" ? (
          <p
            className="hubspotSyncStatus hubspotSyncStatus-connected"
            role="status"
          >
            Your organization and its data have been deleted.
          </p>
        ) : null}
        {reset === "1" ? (
          <p
            className="hubspotSyncStatus hubspotSyncStatus-connected"
            role="status"
          >
            Your password has been updated. Sign in with your new password.
          </p>
        ) : null}
        <LoginForm next={next} />
      </section>
    </main>
  );
}
