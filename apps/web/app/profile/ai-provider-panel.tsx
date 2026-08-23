"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AIProviderConnectionStatus } from "@signaldesk/persistence";

import { connectAIProviderAction } from "../_actions/connect-ai-provider";
import { disconnectAIProviderAction } from "../_actions/disconnect-ai-provider";
import { Button } from "../_components/button";

function DisconnectButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        variant="ghost"
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await disconnectAIProviderAction("anthropic");

            if (result.ok) {
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
      >
        {isPending ? "Disconnecting…" : "Disconnect"}
      </Button>
      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ConnectAIProviderForm() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("provider", "anthropic");
      formData.set("apiKey", apiKey);

      const result = await connectAIProviderAction(
        { error: null, message: null },
        formData,
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setMessage(result.message);
      setApiKey("");
      // The connection status above is server-rendered from data fetched
      // before this submission — refresh so it actually shows "Connected"
      // without a manual reload, the same convention team-panel.tsx's
      // InviteMemberForm already established.
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="authForm">
      <div className="authField">
        <label htmlFor="ai-provider-key">Anthropic API key</label>
        <input
          id="ai-provider-key"
          name="apiKey"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="sk-ant-..."
          required
        />
        <small>
          Encrypted at rest via Supabase Vault — never displayed again after
          saving, and never sent anywhere except real Claude API calls this
          workspace already makes.
        </small>
      </div>

      {error ? (
        <p className="authError" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="cardActionStatus cardActionStatus-success" role="status">
          {message}
        </p>
      ) : null}

      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save key"}
      </Button>
    </form>
  );
}

export function AIProviderPanel({
  status,
  canManage,
}: {
  status: AIProviderConnectionStatus;
  canManage: boolean;
}) {
  return (
    <div className="teamPanel">
      <dl className="settingsList">
        <div>
          <dt>Anthropic (Claude)</dt>
          <dd>
            {status.connected
              ? `Connected${status.updatedAt ? ` · updated ${status.updatedAt.toLocaleDateString()}` : ""}`
              : "Not connected"}
            {status.connected && canManage ? <DisconnectButton /> : null}
          </dd>
        </div>
      </dl>

      {canManage ? (
        <div className="teamPanelInviteForm">
          <h3>
            {status.connected
              ? "Replace key"
              : "Connect your own Anthropic key"}
          </h3>
          <p className="dailyBriefMeta">
            When connected, this workspace&rsquo;s AI investigations run on your
            own Anthropic account/budget instead of the platform&rsquo;s default
            key. This only changes which key funds the existing,
            already-approval-gated AI investigation — it does not grant AI any
            new ability to act.
          </p>
          <ConnectAIProviderForm />
        </div>
      ) : null}
    </div>
  );
}
