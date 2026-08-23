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
        subscription, and scrubs personal information — your name, email, and
        the contact names on your leads, invoices, and tasks — replacing each
        with a placeholder. The underlying business records themselves stay in
        place (so they can&rsquo;t be tied back to you or your customers by
        name), rather than being deleted outright. Free-text fields like message
        bodies and support ticket notes aren&rsquo;t scrubbed today. This cannot
        be undone.
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
