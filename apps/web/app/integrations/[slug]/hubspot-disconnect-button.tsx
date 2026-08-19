"use client";

import { useActionState } from "react";

import {
  disconnectHubSpotAction,
  type DisconnectHubSpotState,
} from "../../_actions/disconnect-hubspot";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectHubSpotState = { error: null };

export function HubSpotDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectHubSpotAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect HubSpot"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
