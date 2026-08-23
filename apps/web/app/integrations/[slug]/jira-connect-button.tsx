"use client";

import { useActionState } from "react";

import {
  connectJiraAction,
  type ConnectJiraState,
} from "../../_actions/connect-jira";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectJiraState = { error: null };

export function JiraConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectJiraAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to Jira…" : "Connect Jira"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
