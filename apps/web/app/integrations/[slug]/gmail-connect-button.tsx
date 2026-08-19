"use client";

import { useActionState } from "react";

import {
  connectGmailAction,
  type ConnectGmailState,
} from "../../_actions/connect-gmail";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectGmailState = { error: null };

export function GmailConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectGmailAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to Google…" : "Connect Gmail"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
