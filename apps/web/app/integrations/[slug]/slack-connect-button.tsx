"use client";

import { useActionState } from "react";

import {
  connectSlackAction,
  type ConnectSlackState,
} from "../../_actions/connect-slack";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectSlackState = { error: null };

export function SlackConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectSlackAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to Slack…" : "Connect Slack"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
