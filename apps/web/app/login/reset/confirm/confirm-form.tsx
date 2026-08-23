"use client";

import { useActionState } from "react";

import {
  updatePasswordAction,
  type AuthActionState,
} from "../../../_actions/auth";
import { Button } from "../../../_components/button";

const INITIAL_STATE: AuthActionState = { error: null };

export function ConfirmResetForm() {
  const [state, formAction, isPending] = useActionState(
    updatePasswordAction,
    INITIAL_STATE,
  );

  return (
    <form className="authForm" action={formAction}>
      <div className="authField">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
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
        {isPending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
