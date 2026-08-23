import type { ConnectorCapabilityClass } from "@signaldesk/integrations";

import type { MetricDefinition } from "./types";

/**
 * One connector's real, synced authority claim over a capability class —
 * the input `detectMetricAuthorityConflicts` reasons over. Shaped like
 * `apps/web`'s `ConnectorHealthSummary` but declared locally: this package
 * stays decoupled from that app-level type, the same boundary
 * `BusinessDomainCapabilityClass`'s own doc comment already draws for a
 * different pair of packages (`apps/web/app/_lib/business-snapshot.ts`).
 */
export interface ConnectedAuthority {
  readonly sourceSystem: string;
  readonly capabilityClass: ConnectorCapabilityClass;
  readonly hasRealSync: boolean;
}

export interface MetricAuthorityConflict {
  readonly metricId: string;
  readonly capabilityClass: ConnectorCapabilityClass;
  readonly conflictingSourceSystems: readonly string[];
}

/**
 * Flags a metric whose declared `authorityCapabilityClass` has more than
 * one actively-synced connector claiming it. This can never actually fire
 * today — every capability class this app's metrics declare has exactly
 * one connector with real sync (QuickBooks for `accounting`, HubSpot for
 * `crm`, Asana for `tasks`) — but the check is real and tested against a
 * synthetic multi-connector scenario (`authority.test.ts`), so it starts
 * working the day a second connector in the same class ships real sync,
 * rather than needing to be built retroactively once the ambiguity is
 * already live.
 *
 * `preferredSourceSystem` is the extension point a future per-tenant
 * `MetricAuthority` configuration (Prompt 21's own "allow Industry Packs
 * and tenant configuration to specify authoritative systems") would set —
 * passing it suppresses the conflict for that one metric. No such
 * configuration store exists yet, so no real caller passes it today; the
 * parameter stays here so adding that configuration later doesn't require
 * reshaping this function's signature.
 */
export function detectMetricAuthorityConflicts(
  metric: MetricDefinition,
  connectedAuthorities: readonly ConnectedAuthority[],
  preferredSourceSystem?: string,
): MetricAuthorityConflict | null {
  if (metric.authorityCapabilityClass === null) {
    return null;
  }

  const claimants = connectedAuthorities.filter(
    (authority) =>
      authority.capabilityClass === metric.authorityCapabilityClass &&
      authority.hasRealSync,
  );
  const distinctSystems = Array.from(
    new Set(claimants.map((authority) => authority.sourceSystem)),
  );

  if (distinctSystems.length <= 1) {
    return null;
  }

  if (
    preferredSourceSystem !== undefined &&
    distinctSystems.includes(preferredSourceSystem)
  ) {
    return null;
  }

  return {
    metricId: metric.id,
    capabilityClass: metric.authorityCapabilityClass,
    conflictingSourceSystems: distinctSystems,
  };
}
