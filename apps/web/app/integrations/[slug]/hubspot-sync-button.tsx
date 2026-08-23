"use client";

import { useActionState } from "react";

import {
  syncHubSpotAction,
  type SyncHubSpotState,
} from "../../_actions/sync-hubspot";
import { Button } from "../../_components/button";

const INITIAL_STATE: SyncHubSpotState = { error: null, syncedCount: null };

export function HubSpotSyncButton() {
  const [state, formAction, isPending] = useActionState(
    syncHubSpotAction,
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
          Synced {state.syncedCount} deal{state.syncedCount === 1 ? "" : "s"}.
        </p>
      ) : null}
    </form>
  );
}
