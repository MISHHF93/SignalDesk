"use client";

import { useActionState } from "react";

import {
  connectAsanaAction,
  type ConnectAsanaState,
} from "../../_actions/connect-asana";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectAsanaState = { error: null };

export function AsanaConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectAsanaAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to Asana…" : "Connect Asana"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
