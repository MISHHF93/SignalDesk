"use client";

import { useActionState } from "react";

import {
  resumeSubscriptionAction,
  type ResumeSubscriptionState,
} from "../_actions/resume-subscription";
import { Button } from "../_components/button";

const INITIAL_STATE: ResumeSubscriptionState = { error: null };

export function ResumeSubscriptionButton() {
  const [state, formAction, isPending] = useActionState(
    resumeSubscriptionAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Resuming…" : "Resume subscription"}
      </Button>
      {state.error ? (
        <p className="authError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
