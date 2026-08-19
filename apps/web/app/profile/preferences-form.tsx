"use client";

import { useActionState } from "react";

import {
  updatePreferencesAction,
  type UpdatePreferencesState,
} from "../_actions/update-preferences";
import { Button } from "../_components/button";

const INITIAL_STATE: UpdatePreferencesState = { error: null, savedAt: null };

const PREFERENCE_FIELDS = [
  {
    name: "morningBriefEnabled",
    label: "Morning brief",
    description: "Daily operating summary at 8:00 AM",
  },
  {
    name: "attentionAlertsEnabled",
    label: "Attention alerts",
    description: "High-priority changes in connected systems",
  },
  {
    name: "weeklyRecapEnabled",
    label: "Weekly recap",
    description: "Read-only performance review",
  },
] as const;

export function PreferencesForm({
  morningBriefEnabled,
  attentionAlertsEnabled,
  weeklyRecapEnabled,
  canEdit,
}: {
  morningBriefEnabled: boolean;
  attentionAlertsEnabled: boolean;
  weeklyRecapEnabled: boolean;
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    updatePreferencesAction,
    INITIAL_STATE,
  );
  const currentValues: Record<
    (typeof PREFERENCE_FIELDS)[number]["name"],
    boolean
  > = {
    morningBriefEnabled,
    attentionAlertsEnabled,
    weeklyRecapEnabled,
  };

  if (!canEdit) {
    return (
      <>
        <ul className="preferenceList" aria-label="Notification preferences">
          {PREFERENCE_FIELDS.map((field) => (
            <li className="preferenceOption" key={field.name}>
              <span>
                <strong>{field.label}</strong>
                <small>{field.description}</small>
              </span>
              <span
                className={`preferenceState ${currentValues[field.name] ? "on" : "off"}`}
              >
                {currentValues[field.name] ? "On" : "Off"}
              </span>
            </li>
          ))}
        </ul>
        <small>Only the workspace owner can change preferences.</small>
      </>
    );
  }

  return (
    <form className="authForm" action={formAction}>
      <ul className="preferenceList" aria-label="Notification preferences">
        {PREFERENCE_FIELDS.map((field) => (
          <li className="preferenceOption" key={field.name}>
            <span>
              <strong>{field.label}</strong>
              <small>{field.description}</small>
            </span>
            <input
              type="checkbox"
              className="preferenceToggle"
              name={field.name}
              aria-label={field.label}
              defaultChecked={currentValues[field.name]}
            />
          </li>
        ))}
      </ul>

      {state.error ? (
        <p className="authError" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.savedAt ? (
        <p className="cardActionStatus cardActionStatus-success" role="status">
          Saved.
        </p>
      ) : null}

      <Button variant="primary" type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
