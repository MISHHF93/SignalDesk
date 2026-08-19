"use client";

import { useActionState } from "react";

import {
  disconnectGoogleCalendarAction,
  type DisconnectGoogleCalendarState,
} from "../../_actions/disconnect-google-calendar";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectGoogleCalendarState = { error: null };

export function GoogleCalendarDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectGoogleCalendarAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect Google Calendar"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
