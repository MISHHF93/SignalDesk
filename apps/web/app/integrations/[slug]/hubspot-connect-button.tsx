"use client";

import { useActionState } from "react";

import {
  connectHubSpotAction,
  type ConnectHubSpotState,
} from "../../_actions/connect-hubspot";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectHubSpotState = { error: null };

export function HubSpotConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectHubSpotAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to HubSpot…" : "Connect HubSpot"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
