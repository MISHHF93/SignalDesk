"use client";

import { useActionState } from "react";

import {
  updateBusinessProfileAction,
  type UpdateBusinessProfileState,
} from "../_actions/update-business-profile";
import { Button } from "../_components/button";

const INITIAL_STATE: UpdateBusinessProfileState = {
  error: null,
  savedAt: null,
};

// Bit n (0 = Sunday, matching JS Date.getUTCDay()) set means day n is a
// working day — must match packages/domain's ALL_DAYS_BITMASK convention.
const WEEKDAYS = [
  { bit: 0, label: "Sun" },
  { bit: 1, label: "Mon" },
  { bit: 2, label: "Tue" },
  { bit: 3, label: "Wed" },
  { bit: 4, label: "Thu" },
  { bit: 5, label: "Fri" },
  { bit: 6, label: "Sat" },
] as const;

function describeWorkingDays(workingDaysBitmask: number): string {
  const labels = WEEKDAYS.filter(
    (day) => (workingDaysBitmask & (1 << day.bit)) !== 0,
  ).map((day) => day.label);

  return labels.length === 0 ? "No working days set" : labels.join(", ");
}

export function BusinessProfileForm({
  timezone,
  defaultExpectedResponseHours,
  highValueThresholdCents,
  workingDaysBitmask,
  canEdit,
}: {
  timezone: string;
  defaultExpectedResponseHours: number;
  highValueThresholdCents: number;
  workingDaysBitmask: number;
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    updateBusinessProfileAction,
    INITIAL_STATE,
  );

  if (!canEdit) {
    return (
      <dl className="settingsList">
        <div>
          <dt>Timezone</dt>
          <dd>{timezone}</dd>
        </div>
        <div>
          <dt>Expected response time</dt>
          <dd>{defaultExpectedResponseHours} hours</dd>
        </div>
        <div>
          <dt>High-value threshold</dt>
          <dd>${(highValueThresholdCents / 100).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Working days</dt>
          <dd>{describeWorkingDays(workingDaysBitmask)}</dd>
        </div>
        <small>Only the workspace owner can change these settings.</small>
      </dl>
    );
  }

  return (
    <form className="authForm businessProfileForm" action={formAction}>
      <div className="authField">
        <label htmlFor="timezone">Timezone</label>
        <input
          id="timezone"
          name="timezone"
          type="text"
          defaultValue={timezone}
          placeholder="America/Toronto"
          required
        />
        <small>
          A real IANA zone name — used to display dates on your command center.
        </small>
      </div>

      <div className="authField">
        <label htmlFor="defaultExpectedResponseHours">
          Expected response time (hours)
        </label>
        <input
          id="defaultExpectedResponseHours"
          name="defaultExpectedResponseHours"
          type="number"
          min={1}
          max={720}
          defaultValue={defaultExpectedResponseHours}
          required
        />
        <small>
          A new lead with no reply after this many hours counts as stuck.
        </small>
      </div>

      <div className="authField">
        <label htmlFor="highValueThresholdDollars">
          High-value threshold ($)
        </label>
        <input
          id="highValueThresholdDollars"
          name="highValueThresholdDollars"
          type="number"
          min={0}
          step={1}
          defaultValue={Math.round(highValueThresholdCents / 100)}
          required
        />
        <small>
          A stuck lead worth at least this much is treated as critical severity,
          not just high.
        </small>
      </div>

      <fieldset className="authField workingDaysField">
        <legend>Working days</legend>
        <div className="workingDaysGrid">
          {WEEKDAYS.map((day) => (
            <label key={day.bit} className="workingDayOption">
              <input
                type="checkbox"
                name="workingDays"
                value={day.bit}
                defaultChecked={(workingDaysBitmask & (1 << day.bit)) !== 0}
              />
              {day.label}
            </label>
          ))}
        </div>
        <small>
          A lead that arrives outside these days doesn&rsquo;t start counting
          toward your response-time threshold until the next working day.
        </small>
      </fieldset>

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
        {isPending ? "Saving…" : "Save business settings"}
      </Button>
    </form>
  );
}
