"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  requestPasswordResetAction,
  type AuthActionState,
} from "../../_actions/auth";
import { Button } from "../../_components/button";

const INITIAL_STATE: AuthActionState = { error: null };

export function ResetRequestForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    INITIAL_STATE,
  );
  // See LoginForm's identical fix — React resets uncontrolled fields in a
  // `<form action={fn}>` after every action call, which would otherwise
  // force a retype of the email after a blank-field or rate-limit error.
  const [email, setEmail] = useState("");

  if (state.message) {
    return (
      <p
        className="hubspotSyncStatus hubspotSyncStatus-connected"
        role="status"
      >
        {state.message}
      </p>
    );
  }

  return (
    <form className="authForm" action={formAction}>
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
        {isPending ? "Sending…" : "Send reset link"}
      </Button>

      <p className="authSwitch">
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  );
}
