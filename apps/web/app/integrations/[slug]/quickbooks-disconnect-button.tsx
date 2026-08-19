"use client";

import { useActionState } from "react";

import {
  disconnectQuickBooksAction,
  type DisconnectQuickBooksState,
} from "../../_actions/disconnect-quickbooks";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectQuickBooksState = { error: null };

export function QuickBooksDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectQuickBooksAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect QuickBooks"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
