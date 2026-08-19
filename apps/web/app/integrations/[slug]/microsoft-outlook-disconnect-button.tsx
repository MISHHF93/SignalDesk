"use client";

import { useActionState } from "react";

import {
  disconnectMicrosoftOutlookAction,
  type DisconnectMicrosoftOutlookState,
} from "../../_actions/disconnect-microsoft-outlook";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectMicrosoftOutlookState = { error: null };

export function MicrosoftOutlookDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectMicrosoftOutlookAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect Outlook"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
