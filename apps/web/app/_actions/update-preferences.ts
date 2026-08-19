"use server";

import {
  createDatabasePool,
  updateOrganizationPreferences,
} from "@signaldesk/persistence";
import { parseUpdatePreferencesInput } from "@signaldesk/schemas";

import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

export interface UpdatePreferencesState {
  readonly error: string | null;
  readonly savedAt: string | null;
}

let pool: ReturnType<typeof createDatabasePool> | undefined;

function getPool() {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * Updates the organization's notification preferences (morning brief,
 * attention alerts, weekly recap) — real settings replacing the
 * Preferences card's former "Example default" read-only placeholders.
 * Same owner-only gate as `updateBusinessProfileAction`: today's identity
 * model has exactly one owner per organization, so this doesn't yet
 * restrict anything a real user would notice, but it keeps this action
 * consistent with the same policy-change reasoning business profile
 * updates already follow.
 */
export async function updatePreferencesAction(
  _prevState: UpdatePreferencesState,
  formData: FormData,
): Promise<UpdatePreferencesState> {
  const session = await getCurrentOrganization();

  if (!session) {
    return { error: "Sign in to manage preferences.", savedAt: null };
  }

  if (session.role !== "owner") {
    return {
      error: "Only the workspace owner can change preferences.",
      savedAt: null,
    };
  }

  try {
    const input = parseUpdatePreferencesInput({
      morningBriefEnabled: formData.has("morningBriefEnabled"),
      attentionAlertsEnabled: formData.has("attentionAlertsEnabled"),
      weeklyRecapEnabled: formData.has("weeklyRecapEnabled"),
    });

    await updateOrganizationPreferences(
      getPool(),
      session.organizationId,
      session.userId,
      input,
    );

    return { error: null, savedAt: new Date().toISOString() };
  } catch (error) {
    return {
      error: describeActionError(error, "Failed to update preferences."),
      savedAt: null,
    };
  }
}
