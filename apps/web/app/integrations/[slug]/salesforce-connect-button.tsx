"use client";

import { useActionState } from "react";

import {
  connectSalesforceAction,
  type ConnectSalesforceState,
} from "../../_actions/connect-salesforce";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectSalesforceState = { error: null };

export function SalesforceConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectSalesforceAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to Salesforce…" : "Connect Salesforce"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
