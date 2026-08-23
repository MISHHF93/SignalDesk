"use client";

import { useActionState } from "react";

import {
  syncSalesforceAction,
  type SyncSalesforceState,
} from "../../_actions/sync-salesforce";
import { Button } from "../../_components/button";

const INITIAL_STATE: SyncSalesforceState = { error: null, syncedCount: null };

export function SalesforceSyncButton() {
  const [state, formAction, isPending] = useActionState(
    syncSalesforceAction,
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
          Synced {state.syncedCount} opportunit
          {state.syncedCount === 1 ? "y" : "ies"}.
        </p>
      ) : null}
    </form>
  );
}
