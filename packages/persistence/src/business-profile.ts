import type { DatabasePool } from "./client";
import { insertAuditEvent } from "./audit-events";
import { withTenantContext } from "./tenant-context";

export interface OrganizationBusinessProfile {
  readonly timezone: string;
  readonly defaultExpectedResponseHours: number;
  readonly highValueThresholdCents: number;
  /**
   * Bit n (0 = Sunday, matching JS `Date.getUTCDay()`) set means day n is a
   * working day — real callers of `evaluateUntouchedLead`
   * (`@signaldesk/domain`) must pass this so elapsed-time
   * calculations count only the organization's own working days.
   */
  readonly workingDaysBitmask: number;
  /**
   * `"unspecified"` or `"professional_services"` (0033/ADR 0019) — kept as
   * a plain string here, not the `OrganizationIndustry` union from
   * `@signaldesk/integrations`, since this package doesn't depend on that
   * one (matches how `BusinessDomainPurpose` is independently redeclared
   * in `apps/web/app/_lib/business-snapshot.ts`). Validated at the Zod
   * boundary (`@signaldesk/schemas`), not here.
   */
  readonly industry: string;
}

interface BusinessProfileRow {
  readonly timezone: string;
  readonly default_expected_response_hours: number;
  readonly high_value_threshold_cents: string;
  readonly working_days_bitmask: number;
  readonly industry: string;
}

function toProfile(row: BusinessProfileRow): OrganizationBusinessProfile {
  return {
    timezone: row.timezone,
    defaultExpectedResponseHours: row.default_expected_response_hours,
    highValueThresholdCents: Number(row.high_value_threshold_cents),
    workingDaysBitmask: row.working_days_bitmask,
    industry: row.industry,
  };
}

export async function getOrganizationBusinessProfile(
  pool: DatabasePool,
  organizationId: string,
): Promise<OrganizationBusinessProfile> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<BusinessProfileRow>(
      `select timezone, default_expected_response_hours, high_value_threshold_cents, working_days_bitmask, industry
       from organizations where id = $1`,
      [organizationId],
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    return toProfile(row);
  });
}

// Deliberately not `Partial<OrganizationBusinessProfile>` — the caller's
// validated input (`parseUpdateBusinessProfileInput`,
// `@signaldesk/schemas`) comes from Zod `.optional()` fields,
// which infer as `T | undefined` rather than "may be absent," and
// `exactOptionalPropertyTypes` treats those as genuinely different types.
export interface UpdateOrganizationBusinessProfileInput {
  readonly timezone?: string | undefined;
  readonly defaultExpectedResponseHours?: number | undefined;
  readonly highValueThresholdCents?: number | undefined;
  readonly workingDaysBitmask?: number | undefined;
  readonly industry?: string | undefined;
}

/**
 * Updates only the fields provided, records the change as a real audit
 * event (this is a policy change, not routine data), and returns the
 * resulting profile. Validation (real IANA timezone, positive hours,
 * non-negative threshold, in-range bitmask) happens at the boundary that
 * calls this — the Server Action — via `businessProfileUpdateSchema`,
 * matching this codebase's existing rule that persistence functions trust
 * validated input, not re-validate it.
 */
export async function updateOrganizationBusinessProfile(
  pool: DatabasePool,
  organizationId: string,
  userId: string,
  input: UpdateOrganizationBusinessProfileInput,
): Promise<OrganizationBusinessProfile> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<BusinessProfileRow>(
      `update organizations
       set timezone = coalesce($2, timezone),
           default_expected_response_hours = coalesce($3, default_expected_response_hours),
           high_value_threshold_cents = coalesce($4, high_value_threshold_cents),
           working_days_bitmask = coalesce($5, working_days_bitmask),
           industry = coalesce($6, industry)
       where id = $1
       returning timezone, default_expected_response_hours, high_value_threshold_cents, working_days_bitmask, industry`,
      [
        organizationId,
        input.timezone ?? null,
        input.defaultExpectedResponseHours ?? null,
        input.highValueThresholdCents ?? null,
        input.workingDaysBitmask ?? null,
        input.industry ?? null,
      ],
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    // Written in the same transaction as the update above (rather than
    // via a separate `recordAuditEvent` call afterward) so the two can
    // never durably diverge — a failure here rolls back the profile
    // change too, instead of leaving a committed change with no audit
    // record.
    await insertAuditEvent(client, organizationId, {
      userId,
      eventType: "organization.business_profile_updated",
      subjectType: "organization",
      subjectId: organizationId,
      outcome: "succeeded",
      metadata: { ...input },
    });

    return toProfile(row);
  });
}
