"use client";

import { useActionState } from "react";

import {
  disconnectSlackAction,
  type DisconnectSlackState,
} from "../../_actions/disconnect-slack";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectSlackState = { error: null };

export function SlackDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectSlackAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect Slack"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
