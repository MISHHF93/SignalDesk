"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

import { Button } from "./button";

export interface CommandBarProps {
  readonly isPending: boolean;
  readonly statusMessage: string | null;
  readonly onSubmitCommand: (text: string) => void;
  /** Real, server-checked `isAgentFabricEnabled()` state
   * (`_lib/agent-config.ts`) — filters, "why" questions, and task creation
   * are all deterministic and stay available regardless; only
   * "investigate ..." (the Agent Fabric's one real AI trigger,
   * `run-agent-investigation.ts`) depends on this. Surfaced here, in the
   * one place a user would naturally try that phrase, rather than only
   * discovered reactively after typing it and getting a decline message
   * back — a real degradation-mode signal, not a fabricated status. */
  readonly aiInvestigationAvailable: boolean;
}

const DEFAULT_HINT =
  'Try a filter ("only show critical items"), a why question ("why is Acme Robotics at risk"), or "create a task for these."';
const DEFAULT_HINT_AI_UNAVAILABLE =
  'Try a filter ("only show critical items"), a why question ("why is Acme Robotics at risk"), or "create a task for these." AI-assisted investigation is currently unavailable — deterministic findings above are unaffected.';

// `navigator` isn't available during SSR, and never changes after mount —
// `useSyncExternalStore` (rather than a useState+useEffect pair, which
// would call setState synchronously inside an effect) is the primitive
// React provides specifically for a value that can differ between the
// server snapshot and the client snapshot, so hydration is never asked to
// reconcile a mismatch.
const noopSubscribe = () => () => {};

function getKbdHintSnapshot(): string {
  return navigator.platform.toUpperCase().includes("MAC") ? "⌘K" : "Ctrl K";
}

function getKbdHintServerSnapshot(): string {
  return "Ctrl K";
}

export function CommandBar({
  isPending,
  statusMessage,
  onSubmitCommand,
  aiInvestigationAvailable,
}: CommandBarProps) {
  const [value, setValue] = useState("");
  const kbdHint = useSyncExternalStore(
    noopSubscribe,
    getKbdHintSnapshot,
    getKbdHintServerSnapshot,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key === "k";

      if (isShortcut) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return;
    }

    onSubmitCommand(trimmed);
  }

  return (
    <form
      className="askForm activeAskForm"
      onSubmit={handleSubmit}
      aria-describedby="ask-status"
    >
      <label htmlFor="business-question">Ask or command your business</label>
      <fieldset disabled={isPending}>
        <div className="commandInputWrap">
          <input
            ref={inputRef}
            id="business-question"
            name="business-question"
            placeholder="Try: only show items over $10,000"
            type="text"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <kbd className="commandKbdHint" aria-hidden="true">
            {kbdHint}
          </kbd>
        </div>
        <Button variant="primary" type="submit">
          {isPending ? "Asking…" : "Ask"}
        </Button>
      </fieldset>
      <p id="ask-status" aria-live="polite">
        {statusMessage ??
          (aiInvestigationAvailable
            ? DEFAULT_HINT
            : DEFAULT_HINT_AI_UNAVAILABLE)}
      </p>
    </form>
  );
}
