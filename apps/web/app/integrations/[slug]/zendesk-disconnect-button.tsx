"use client";

import { useActionState } from "react";

import {
  disconnectZendeskAction,
  type DisconnectZendeskState,
} from "../../_actions/disconnect-zendesk";
import { Button } from "../../_components/button";

const INITIAL_STATE: DisconnectZendeskState = { error: null };

export function ZendeskDisconnectButton() {
  const [state, formAction, isPending] = useActionState(
    disconnectZendeskAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="ghost" type="submit" disabled={isPending}>
        {isPending ? "Disconnecting…" : "Disconnect Zendesk"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
