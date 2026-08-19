"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInAction, type AuthActionState } from "../_actions/auth";
import { Button } from "../_components/button";
import { GuestButton } from "../_components/guest-button";
import { OAuthButtons } from "../_components/oauth-buttons";

const INITIAL_STATE: AuthActionState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(
    signInAction,
    INITIAL_STATE,
  );

  return (
    <>
      <GuestButton next={next} />

      <div className="authDivider" role="separator">
        <span>or sign in</span>
      </div>

      <form className="authForm" action={formAction}>
        <input type="hidden" name="next" value={next} />

        <div className="authField">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>

        <div className="authField">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {state.error ? (
          <p className="authError" role="alert">
            {state.error}
          </p>
        ) : null}

        <Button
          variant="primary"
          className="authSubmit"
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Signing in…" : "Sign in"}
        </Button>

        <p className="authSwitch">
          New here?{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`}>
            Create an account
          </Link>
        </p>
      </form>

      <OAuthButtons next={next} />
    </>
  );
}
