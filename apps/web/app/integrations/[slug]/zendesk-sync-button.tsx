"use client";

import { useActionState } from "react";

import {
  syncZendeskAction,
  type SyncZendeskState,
} from "../../_actions/sync-zendesk";
import { Button } from "../../_components/button";

const INITIAL_STATE: SyncZendeskState = { error: null, syncedCount: null };

export function ZendeskSyncButton() {
  const [state, formAction, isPending] = useActionState(
    syncZendeskAction,
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
          Synced {state.syncedCount} ticket{state.syncedCount === 1 ? "" : "s"}.
        </p>
      ) : null}
    </form>
  );
}
