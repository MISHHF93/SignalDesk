"use client";

import { useActionState } from "react";

import {
  disconnectMicrosoftCalendarAction,
  type DisconnectMicrosoftCalendarState,
} from "../../_actions/disconnect-microsoft-calendar";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectMicrosoftCalendarState = { error: null };

export function MicrosoftCalendarDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectMicrosoftCalendarAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect Microsoft Calendar"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
