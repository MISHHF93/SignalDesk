"use client";

import { useActionState } from "react";

import {
  disconnectSalesforceAction,
  type DisconnectSalesforceState,
} from "../../_actions/disconnect-salesforce";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectSalesforceState = { error: null };

export function SalesforceDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectSalesforceAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect Salesforce"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
