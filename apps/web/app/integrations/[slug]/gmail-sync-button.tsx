"use client";

import { useActionState } from "react";

import {
  syncGmailAction,
  type SyncGmailState,
} from "../../_actions/sync-gmail";
import { Button } from "../../_components/button";

const INITIAL_STATE: SyncGmailState = { error: null, syncedCount: null };

export function GmailSyncButton() {
  const [state, formAction, isPending] = useActionState(
    syncGmailAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction}>
      <Button variant="secondary" type="submit" disabled={isPending}>
        {isPending ? "Syncing…" : "Sync now"}
      </Button>
      {state.error ? (
        <p className="authError hubspotConnectError" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.syncedCount !== null ? (
        <p className="cardActionStatus cardActionStatus-success" role="status">
          Synced {state.syncedCount} message{state.syncedCount === 1 ? "" : "s"}
          .
        </p>
      ) : null}
    </form>
  );
}
