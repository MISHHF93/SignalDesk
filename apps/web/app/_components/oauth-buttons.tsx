"use client";

import { useActionState } from "react";

import { signInWithOAuthAction, type OAuthActionState } from "../_actions/auth";
import {
  isOAuthProviderEnabled,
  oauthProviders,
} from "../_lib/oauth-providers";
import { OAuthIcon } from "./oauth-icons";

const INITIAL_STATE: OAuthActionState = { error: null };

/**
 * Renders all four requested social sign-in options. A provider that isn't
 * `isOAuthProviderEnabled()` renders as a non-interactive status row, not a
 * disabled-looking button — this app never ships a button that appears
 * clickable but does nothing (see the Integration Hub's "Connection
 * unavailable" pattern for the same honesty rule applied to connectors).
 */
export function OAuthButtons({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(
    signInWithOAuthAction,
    INITIAL_STATE,
  );
  const hasDisabledProvider = oauthProviders.some(
    (provider) => !isOAuthProviderEnabled(provider.id),
  );

  return (
    <div className="oauthGroup">
      <div className="authDivider" role="separator">
        <span>or continue with</span>
      </div>

      <form action={formAction} className="oauthForm">
        <input type="hidden" name="next" value={next} />
        {oauthProviders.map((provider) =>
          isOAuthProviderEnabled(provider.id) ? (
            <button
              key={provider.id}
              type="submit"
              name="provider"
              value={provider.id}
              className="oauthButton"
              disabled={isPending}
            >
              <OAuthIcon provider={provider.id} />
              <span className="oauthButtonLabel">
                Continue with {provider.label}
              </span>
            </button>
          ) : (
            <span
              key={provider.id}
              className="oauthButton oauthButtonDisabled"
              title={`${provider.label} sign-in is not yet connected`}
            >
              <OAuthIcon provider={provider.id} />
              <span className="oauthButtonLabel">
                Continue with {provider.label}
              </span>
              <span className="oauthNotConnected">Not yet connected</span>
            </span>
          ),
        )}
      </form>

      {state.error ? (
        <p className="authError" role="alert">
          {state.error}
        </p>
      ) : null}

      {hasDisabledProvider ? (
        <p className="oauthSetupHint">
          Social sign-in needs a real OAuth app registered with each provider (a
          one-time setup step, not a per-sign-in one) — see{" "}
          <code>NEXT_PUBLIC_ENABLED_OAUTH_PROVIDERS</code> in{" "}
          <code>.env.example</code>. Email and guest sign-in work today without
          it.
        </p>
      ) : null}
    </div>
  );
}
