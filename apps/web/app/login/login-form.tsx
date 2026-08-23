"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

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
  // React resets every uncontrolled field in a `<form action={fn}>` after
  // the action runs, success or failure — including on a wrong-password
  // rejection, the single most common reason this form re-renders with an
  // error. Left uncontrolled, that forces a retype of the email too, not
  // just the password, on every failed attempt. Controlled here so it
  // survives; the password field is deliberately left uncontrolled (and so
  // still clears) — that's normal, expected behavior after a failed
  // sign-in, not a bug to fix alongside this one.
  const [email, setEmail] = useState("");

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
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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

        <p className="authSwitch">
          <Link href="/login/reset">Forgot your password?</Link>
        </p>

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
