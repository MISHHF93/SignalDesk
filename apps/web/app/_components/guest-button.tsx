"use client";

import { useActionState } from "react";

import { continueAsGuestAction, type GuestActionState } from "../_actions/auth";
import { Button } from "./button";

const INITIAL_STATE: GuestActionState = { error: null };

export function GuestButton({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(
    continueAsGuestAction,
    INITIAL_STATE,
  );

  return (
    <div className="guestGroup">
      <form action={formAction}>
        <input type="hidden" name="next" value={next} />
        <Button
          variant="secondary"
          className="guestButton"
          type="submit"
          disabled={isPending}
        >
          {isPending ? "Setting up your workspace…" : "Continue as guest"}
        </Button>
      </form>
      <p className="guestHint">
        Skips creating an account — you get your own real, private workspace
        instantly.
      </p>
      {state.error ? (
        <p className="authError" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
