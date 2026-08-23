"use client";

import { useActionState } from "react";

import {
  connectXeroAction,
  type ConnectXeroState,
} from "../../_actions/connect-xero";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectXeroState = { error: null };

export function XeroConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectXeroAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to Xero…" : "Connect Xero"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
