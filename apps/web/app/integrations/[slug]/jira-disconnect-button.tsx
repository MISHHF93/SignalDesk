"use client";

import { useActionState } from "react";

import {
  disconnectJiraAction,
  type DisconnectJiraState,
} from "../../_actions/disconnect-jira";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectJiraState = { error: null };

export function JiraDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectJiraAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect Jira"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
