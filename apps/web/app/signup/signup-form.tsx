"use client";

import Link from "next/link";
import { useActionState } from "react";

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
            defaultValue={prefillEmail}
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
