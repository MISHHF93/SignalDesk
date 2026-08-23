"use client";

import { useActionState } from "react";

import { syncJiraAction, type SyncJiraState } from "../../_actions/sync-jira";
import { Button } from "../../_components/button";

const INITIAL_STATE: SyncJiraState = { error: null, syncedCount: null };

export function JiraSyncButton() {
  const [state, formAction, isPending] = useActionState(
    syncJiraAction,
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
          Synced {state.syncedCount} issue{state.syncedCount === 1 ? "" : "s"}.
        </p>
      ) : null}
    </form>
  );
}
