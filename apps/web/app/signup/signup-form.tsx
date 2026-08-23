"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signUpAction, type AuthActionState } from "../_actions/auth";
import { Button } from "../_components/button";
import { OAuthButtons } from "../_components/oauth-buttons";

const INITIAL_STATE: AuthActionState = { error: null };

export function SignupForm({
  next,
  inviteToken,
  prefillEmail,
}: {
  next: string;
  /** Present only for a real, currently-valid invite (Phase 3,
   * implementation roadmap) — see `signup/page.tsx`'s own validation. */
  inviteToken?: string;
  prefillEmail?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    INITIAL_STATE,
  );
  // React resets every uncontrolled field in a `<form action={fn}>` after
  // the action runs, success or failure — e.g. a taken-email rejection or
  // a transient error, forcing a retype of the email too, not just
  // whatever was actually wrong. Controlled here so it survives; the
  // password field is deliberately left uncontrolled (and so still
  // clears) — that's normal, expected behavior after a failed submission,
  // not a bug to fix alongside this one.
  const [email, setEmail] = useState(prefillEmail ?? "");

  return (
    <>
      <form className="authForm" action={formAction}>
        <input type="hidden" name="next" value={next} />
        {inviteToken ? (
          <input type="hidden" name="inviteToken" value={inviteToken} />
        ) : null}

        <div className="authField">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={prefillEmail ?? email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={Boolean(prefillEmail)}
            required
          />
          {prefillEmail ? (
            <p className="authHint">
              This invite is for {prefillEmail} specifically.
            </p>
          ) : null}
        </div>

        <div className="authField">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="authHint">At least 8 characters.</p>
        </div>

        {state.error ? (
          <p className="authError" role="alert">
            {state.error}
          </p>
        ) : null}

        {state.message ? (
          <p className="authMessage" role="status">
            {state.message}
          </p>
        ) : null}

        <Button
          variant="primary"
          className="authSubmit"
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Creating account…" : "Create account"}
        </Button>

        <p className="authSwitch">
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
        </p>
      </form>

      <OAuthButtons next={next} />
    </>
  );
}
