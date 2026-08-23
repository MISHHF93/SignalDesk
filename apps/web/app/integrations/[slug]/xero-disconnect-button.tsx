"use client";

import { useActionState } from "react";

import {
  disconnectXeroAction,
  type DisconnectXeroState,
} from "../../_actions/disconnect-xero";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectXeroState = { error: null };

export function XeroDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectXeroAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect Xero"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
