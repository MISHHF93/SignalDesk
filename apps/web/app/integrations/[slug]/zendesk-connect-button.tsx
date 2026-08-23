"use client";

import { useActionState } from "react";

import {
  connectZendeskAction,
  type ConnectZendeskState,
} from "../../_actions/connect-zendesk";
import { Button } from "../../_components/button";

const INITIAL_STATE: ConnectZendeskState = { error: null };

/**
 * Unlike every other connector's connect button, this one carries a real
 * text input — the Zendesk subdomain (e.g. "acme" for
 * acme.zendesk.com) — since Zendesk's OAuth flow needs it before the
 * redirect even starts (see `connect-zendesk.ts`'s own doc comment).
 */
export function ZendeskConnectButton() {
  const [state, formAction, isPending] = useActionState(
    connectZendeskAction,
    INITIAL_STATE,
  );

  return (
    <form action={formAction} className="authForm">
      <div className="authField">
        <label htmlFor="zendesk-subdomain">Zendesk subdomain</label>
        <input
          id="zendesk-subdomain"
          name="subdomain"
          type="text"
          placeholder="acme"
          autoComplete="off"
          required
        />
      </div>
      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Redirecting to Zendesk…" : "Connect Zendesk"}
      </Button>
      {state.error ? (
        <p className="authError" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
