"use client";

import { useActionState } from "react";

import {
  connectMicrosoftOutlookAction,
  type ConnectMicrosoftOutlookState,
} from "../../_actions/connect-microsoft-outlook";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectMicrosoftOutlookState = { error: null };

export function MicrosoftOutlookConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectMicrosoftOutlookAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to Microsoft…" : "Connect Outlook"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
