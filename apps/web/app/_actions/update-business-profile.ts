"use server";

import {
  createDatabasePool,
  updateOrganizationBusinessProfile,
} from "@signaldesk/persistence";
import { parseUpdateBusinessProfileInput } from "@signaldesk/schemas";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

export interface UpdateBusinessProfileState {
  readonly error: string | null;
  readonly savedAt: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Updates the organization's Business Profile (timezone, expected
 * response hours, high-value threshold) — real per-org settings that used
 * to be hardcoded platform-wide constants. Only an owner/admin should be
 * able to change organization-wide policy; today's model has exactly one
 * role (`owner`) per solo-provisioned organization, so this checks that
 * explicitly rather than assuming any signed-in member may.
 */
export async function updateBusinessProfileAction(
  _prevState: UpdateBusinessProfileState,
  formData: FormData,
): Promise<UpdateBusinessProfileState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage business settings.", savedAt: null };
  }

  if (session.role !== "owner") {
    return {
      error: "Only the workspace owner can change business settings.",
      savedAt: null,
    };
  }

  const rawResponseHours = formData.get("defaultExpectedResponseHours");
  const rawThresholdDollars = formData.get("highValueThresholdDollars");
  // Every checked "workingDays" box in the range 0-6 sets that bit — unlike
  // the other fields, this is never conditionally included: the checkbox
  // fieldset is always rendered in full, so "nothing checked" is a real,
  // meaningful submitted state (bitmask 0), not "field absent, don't touch
  // it."
  const workingDaysBitmask = formData
    .getAll("workingDays")
    .map((value) => Number(value))
    .reduce((bitmask, bit) => bitmask | (1 << bit), 0);

  try {
    const input = parseUpdateBusinessProfileInput({
      timezone: String(formData.get("timezone") ?? ""),
      workingDaysBitmask,
      ...(rawResponseHours
        ? { defaultExpectedResponseHours: Number(rawResponseHours) }
        : {}),
      ...(rawThresholdDollars
        ? {
            highValueThresholdCents: Math.round(
              Number(rawThresholdDollars) * 100,
            ),
          }
        : {}),
    });

    await updateOrganizationBusinessProfile(
      getPool(),
      session.organizationId,
      session.userId,
      input,
    );

    return { error: null, savedAt: new Date().toISOString() };
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to update business settings."),
      savedAt: null,
    };
  }
}
