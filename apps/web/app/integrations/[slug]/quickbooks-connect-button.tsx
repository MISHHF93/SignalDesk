"use client";

import { useActionState } from "react";

import {
  connectQuickBooksAction,
  type ConnectQuickBooksState,
} from "../../_actions/connect-quickbooks";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectQuickBooksState = { error: null };

export function QuickBooksConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectQuickBooksAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to QuickBooks…" : "Connect QuickBooks"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
