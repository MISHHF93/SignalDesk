import { describe, expect, it } from "vitest";

import {
  detectMetricAuthorityConflicts,
  type ConnectedAuthority,
} from "./authority";
import { ACCOUNTS_RECEIVABLE } from "./catalog";

describe("detectMetricAuthorityConflicts", () => {
  it("returns null when only one connector is authoritative", () => {
    const authorities: readonly ConnectedAuthority[] = [
      {
        sourceSystem: "quickbooks",
        capabilityClass: "accounting",
        hasRealSync: true,
      },
    ];

    expect(
      detectMetricAuthorityConflicts(ACCOUNTS_RECEIVABLE, authorities),
    ).toBeNull();
  });

  it("ignores a connector that is connected but has no real sync", () => {
    const authorities: readonly ConnectedAuthority[] = [
      {
        sourceSystem: "quickbooks",
        capabilityClass: "accounting",
        hasRealSync: true,
      },
      {
        sourceSystem: "xero",
        capabilityClass: "accounting",
        hasRealSync: false,
      },
    ];

    expect(
      detectMetricAuthorityConflicts(ACCOUNTS_RECEIVABLE, authorities),
    ).toBeNull();
  });

  it("flags a real conflict — two actively-synced connectors in the same capability class", () => {
    const authorities: readonly ConnectedAuthority[] = [
      {
        sourceSystem: "quickbooks",
        capabilityClass: "accounting",
        hasRealSync: true,
      },
      {
        sourceSystem: "xero",
        capabilityClass: "accounting",
        hasRealSync: true,
      },
    ];

    const conflict = detectMetricAuthorityConflicts(
      ACCOUNTS_RECEIVABLE,
      authorities,
    );

    expect(conflict).not.toBeNull();
    expect(conflict?.capabilityClass).toBe("accounting");
    expect([...(conflict?.conflictingSourceSystems ?? [])].sort()).toEqual([
      "quickbooks",
      "xero",
    ]);
  });

  it("suppresses the conflict when a preferred source system is declared", () => {
    const authorities: readonly ConnectedAuthority[] = [
      {
        sourceSystem: "quickbooks",
        capabilityClass: "accounting",
        hasRealSync: true,
      },
      {
        sourceSystem: "xero",
        capabilityClass: "accounting",
        hasRealSync: true,
      },
    ];

    expect(
      detectMetricAuthorityConflicts(
        ACCOUNTS_RECEIVABLE,
        authorities,
        "quickbooks",
      ),
    ).toBeNull();
  });

  it("ignores connectors in a different capability class entirely", () => {
    const authorities: readonly ConnectedAuthority[] = [
      { sourceSystem: "hubspot", capabilityClass: "crm", hasRealSync: true },
      { sourceSystem: "salesforce", capabilityClass: "crm", hasRealSync: true },
    ];

    expect(
      detectMetricAuthorityConflicts(ACCOUNTS_RECEIVABLE, authorities),
    ).toBeNull();
  });
});
