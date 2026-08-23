"use client";

import { useActionState, useState } from "react";

import {
  deleteOrganizationAction,
  type DeleteOrganizationState,
} from "../_actions/delete-organization";
import { Button } from "../_components/button";

const CONFIRM_PHRASE = "DELETE";

const INITIAL_STATE: DeleteOrganizationState = { error: null };

export function DeleteOrganizationForm() {
  const [confirmationText, setConfirmationText] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [state, formAction, isPending] = useActionState(
    deleteOrganizationAction,
    INITIAL_STATE,
  );

  if (!isExpanded) {
    return (
      <Button variant="ghost" type="button" onClick={() => setIsExpanded(true)}>
        Delete organization
      </Button>
    );
  }

  return (
    <form action={formAction} className="checkoutForm">
      <p className="dailyBriefMeta">
        This permanently disconnects every integration, cancels any active
        subscription, and erases this organization&rsquo;s personal information.
        Business records are anonymized, not deleted — see ADR 0018 in the
        repository if you want the exact scope. This cannot be undone.
      </p>
      <label>
        Type {CONFIRM_PHRASE} to confirm
        <input
          type="text"
          value={confirmationText}
          onChange={(event) => setConfirmationText(event.target.value)}
          autoComplete="off"
          aria-label={`Type ${CONFIRM_PHRASE} to confirm`}
        />
      </label>
      <div className="dangerZoneActions">
        <Button
          variant="primary"
          type="submit"
          disabled={confirmationText !== CONFIRM_PHRASE || isPending}
        >
          {isPending ? "Deleting…" : "Permanently delete organization"}
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => {
            setIsExpanded(false);
            setConfirmationText("");
          }}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
      {state.error ? (
        <p className="authError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
