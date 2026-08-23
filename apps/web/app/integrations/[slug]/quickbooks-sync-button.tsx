"use client";

import { useActionState } from "react";

import {
  syncQuickBooksAction,
  type SyncQuickBooksState,
} from "../../_actions/sync-quickbooks";
import { Button } from "../../_components/button";

const INITIAL_STATE: SyncQuickBooksState = { error: null, syncedCount: null };

export function QuickBooksSyncButton() {
  const [state, formAction, isPending] = useActionState(
    syncQuickBooksAction,
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
          Synced {state.syncedCount} invoice{state.syncedCount === 1 ? "" : "s"}
          .
        </p>
      ) : null}
    </form>
  );
}
