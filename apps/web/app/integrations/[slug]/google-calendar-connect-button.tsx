"use client";

import { useActionState } from "react";

import {
  connectGoogleCalendarAction,
  type ConnectGoogleCalendarState,
} from "../../_actions/connect-google-calendar";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectGoogleCalendarState = { error: null };

export function GoogleCalendarConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectGoogleCalendarAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to Google…" : "Connect Google Calendar"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
