"use client";

import { useActionState } from "react";

import {
  connectMicrosoftCalendarAction,
  type ConnectMicrosoftCalendarState,
} from "../../_actions/connect-microsoft-calendar";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectMicrosoftCalendarState = { error: null };

export function MicrosoftCalendarConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectMicrosoftCalendarAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to Microsoft…" : "Connect Microsoft Calendar"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
