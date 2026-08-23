import type { Metadata } from "next";

import {
  createDatabasePool,
  validateInviteToken,
  type DatabasePool,
} from "@signaldesk/persistence";

import { safeNextPath } from "../_lib/safe-next-path";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create account",
};

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; invite?: string }>;
}) {
  const { next: rawNext, invite: inviteToken } = await searchParams;
  const next = safeNextPath(rawNext);

  // Real, pre-authentication validation (Phase 3, implementation
  // roadmap) — `validateInviteToken` never mutates anything; acceptance
  // only happens once the form below actually submits a real signup.
  // An expired/unknown/already-used token falls back to ordinary signup
  // rather than blocking the page — an honest note explains why, instead
  // of a dead end.
  const invitePreview = inviteToken
    ? await validateInviteToken(getPool(), inviteToken)
    : null;

  return (
    <main className="shell authShell" id="main-content">
      <section className="authCard" aria-labelledby="signup-heading">
        <p className="sectionKicker">Business command center</p>
        <h1 id="signup-heading">Create your account</h1>
        {invitePreview ? (
          <p className="authCopy">
            You&rsquo;ve been invited to join{" "}
            <strong>{invitePreview.organizationName}</strong> as a{" "}
            {invitePreview.role}.
          </p>
        ) : inviteToken ? (
          <p className="authCopy">
            That invite link has expired or was already used. You can still
            create your own account below — no invite needed.
          </p>
        ) : (
          <p className="authCopy">
            Signing up automatically provisions one solo organization you own —
            no invite code needed.
          </p>
        )}
        <SignupForm
          next={next}
          {...(invitePreview && inviteToken ? { inviteToken } : {})}
          {...(invitePreview ? { prefillEmail: invitePreview.email } : {})}
        />
      </section>
    </main>
  );
}
