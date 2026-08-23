"use client";

import { useActionState } from "react";

import {
  syncAsanaAction,
  type SyncAsanaState,
} from "../../_actions/sync-asana";
import { Button } from "../../_components/button";

const INITIAL_STATE: SyncAsanaState = { error: null, syncedCount: null };

export function AsanaSyncButton() {
  const [state, formAction, isPending] = useActionState(
    syncAsanaAction,
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
          Synced {state.syncedCount} task{state.syncedCount === 1 ? "" : "s"}.
        </p>
      ) : null}
    </form>
  );
}
