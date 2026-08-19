import { describe, expect, it } from "vitest";

import {
  computeBusinessCoverage,
  computeBusinessCoverageByPurpose,
  connectorCatalog,
  filterConnectors,
  getConnectorBySlug,
  listConnectors,
  type ConnectorSlug,
} from "../src/index";

const expectedSlugs = [
  "slack",
  "hubspot",
  "gmail",
  "microsoft-outlook",
  "stripe",
  "quickbooks",
  "google-calendar",
  "microsoft-calendar",
  "asana",
  "linear",
];

describe("connectorCatalog", () => {
  it("uses unique, stable connector slugs", () => {
    const slugs = connectorCatalog.map((connector) => connector.slug);

    expect(slugs).toEqual(expectedSlugs);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))).toBe(
      true,
    );
  });

  it("includes Slack prominently as a foundation preview", () => {
    const slack = getConnectorBySlug("slack");

    expect(connectorCatalog[0]?.slug).toBe("slack");
    expect(slack?.availability).toBe("foundation-preview");
    expect(slack?.category).toBe("communication");
    expect(slack?.capabilities.length).toBeGreaterThan(0);
  });

  it("has nonempty product metadata and logical capabilities", () => {
    for (const connector of connectorCatalog) {
      expect(connector.name.trim()).not.toBe("");
      expect(connector.shortDescription.trim()).not.toBe("");
      expect(connector.capabilities.length).toBeGreaterThan(0);

      for (const capability of connector.capabilities) {
        expect(capability.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(capability.label.trim()).not.toBe("");
        expect(capability.description.trim()).not.toBe("");
      }
    }
  });

  // Every catalog connector now has a real, tested OAuth flow — the
  // formerly-separate "reports not-configured honestly" test is retired
  // since there is no longer a not-configured connector left to exercise
  // it against. `codeReadySlugs` is expected to equal the full catalog;
  // the "limits foundation-preview" test below fails loudly if a future
  // connector is added to the catalog without a matching entry here.
  const codeReadySlugs: readonly ConnectorSlug[] = [
    "hubspot",
    "slack",
    "stripe",
    "quickbooks",
    "gmail",
    "google-calendar",
    "microsoft-outlook",
    "microsoft-calendar",
    "asana",
    "linear",
  ];

  it("keeps every gate required and every capability well-formed for each connector", () => {
    for (const connector of connectorCatalog) {
      expect(connector.implementationGates.length).toBeGreaterThan(0);
      expect(
        connector.implementationGates.every(
          (gate) => gate.status === "required",
        ),
      ).toBe(true);
    }
  });

  // The only three connectors with a real one-time sync-on-connect into
  // the Business Graph (HubSpot deals→leads, QuickBooks invoices, Asana
  // tasks) — everything else authenticates but moves no data yet.
  const initialSyncSlugs: ReadonlySet<ConnectorSlug> = new Set([
    "hubspot",
    "quickbooks",
    "asana",
  ]);

  it.each(codeReadySlugs)(
    "reports %s's real, partial readiness honestly — not more, not less",
    (slug) => {
      const connector = connectorCatalog.find((entry) => entry.slug === slug);

      expect(connector?.authStrategy.configuration).toBe("code-ready");
      expect(connector?.authStrategy.scopesDefined).toBe(true);
      expect(connector?.authStrategy.scopes?.length).toBeGreaterThan(0);
      expect(connector?.readiness).toEqual({
        catalogMetadata: true,
        adapterImplemented: true,
        authorizationImplemented: true,
        syncImplemented: false,
        initialSyncImplemented: initialSyncSlugs.has(slug),
        actionsImplemented: false,
        productionReady: false,
      });
    },
  );

  it("limits foundation-preview to exactly the code-ready connectors", () => {
    expect(
      new Set(
        filterConnectors({ availability: "foundation-preview" }).map(
          (connector) => connector.slug,
        ),
      ),
    ).toEqual(new Set(codeReadySlugs));
    expect(filterConnectors({ availability: "planned" })).toHaveLength(
      connectorCatalog.length - codeReadySlugs.length,
    );
  });

  it("requires a write-action safety gate for every write-capable connector", () => {
    for (const connector of filterConnectors({ operation: "write" })) {
      expect(connector.accessPosture).toBe("read-write");
      expect(
        connector.implementationGates.some(
          (gate) => gate.id === "write-action-safety",
        ),
      ).toBe(true);
    }
  });

  it("declares design-intent entity types, data sensitivity, and trust for every connector", () => {
    for (const connector of connectorCatalog) {
      expect(connector.supportedEntityTypes.length).toBeGreaterThan(0);
      expect(typeof connector.dataSensitivity.containsPII).toBe("boolean");
      expect(typeof connector.dataSensitivity.containsFinancialData).toBe(
        "boolean",
      );
      expect(typeof connector.dataSensitivity.containsCustomerData).toBe(
        "boolean",
      );
      expect(connector.trustClassification).toBe("first_party");
    }
  });

  it("marks HubSpot and Stripe as carrying financial data, and Slack as not", () => {
    expect(
      getConnectorBySlug("hubspot")?.dataSensitivity.containsFinancialData,
    ).toBe(true);
    expect(
      getConnectorBySlug("stripe")?.dataSensitivity.containsFinancialData,
    ).toBe(true);
    expect(
      getConnectorBySlug("slack")?.dataSensitivity.containsFinancialData,
    ).toBe(false);
  });
});

describe("computeBusinessCoverage", () => {
  it("reports every category as unconnected when nothing is connected", () => {
    const coverage = computeBusinessCoverage([]);

    expect(coverage.length).toBeGreaterThan(0);
    expect(coverage.every((entry) => entry.status === "none")).toBe(true);
    expect(coverage.every((entry) => entry.connectedCount === 0)).toBe(true);
  });

  it("reports a single-connector category as fully connected", () => {
    const coverage = computeBusinessCoverage(["hubspot"]);
    const crm = coverage.find((entry) => entry.category === "crm");

    expect(crm).toEqual({
      category: "crm",
      status: "connected",
      connectedCount: 1,
      totalCount: 1,
    });
  });

  it("reports a multi-connector category as partial when only one is connected", () => {
    const coverage = computeBusinessCoverage(["gmail"]);
    const email = coverage.find((entry) => entry.category === "email");

    expect(email).toEqual({
      category: "email",
      status: "partial",
      connectedCount: 1,
      totalCount: 2,
    });
  });

  it("ignores a connected slug that isn't in the catalog", () => {
    const coverage = computeBusinessCoverage(["not-a-real-connector"]);

    expect(coverage.every((entry) => entry.connectedCount === 0)).toBe(true);
  });
});

describe("computeBusinessCoverageByPurpose", () => {
  it("reports every purpose as unconnected when nothing is connected", () => {
    const coverage = computeBusinessCoverageByPurpose([]);

    expect(coverage.length).toBeGreaterThan(0);
    expect(coverage.every((entry) => entry.status === "none")).toBe(true);
    expect(
      coverage.every((entry) => entry.connectedConnectorNames.length === 0),
    ).toBe(true);
  });

  it("reports a single-connector purpose as fully connected, by name", () => {
    const coverage = computeBusinessCoverageByPurpose(["hubspot"]);
    const pipeline = coverage.find((entry) => entry.purpose === "pipeline");

    expect(pipeline).toEqual({
      purpose: "pipeline",
      status: "connected",
      connectedConnectorNames: ["HubSpot"],
      totalConnectorNames: ["HubSpot"],
    });
  });

  it("reports a multi-connector purpose as partial when only one is connected", () => {
    const coverage = computeBusinessCoverageByPurpose(["gmail"]);
    const communication = coverage.find(
      (entry) => entry.purpose === "communication",
    );

    expect(communication?.status).toBe("partial");
    expect(communication?.connectedConnectorNames).toEqual(["Gmail"]);
    expect(communication?.totalConnectorNames).toEqual([
      "Slack",
      "Gmail",
      "Microsoft Outlook",
    ]);
  });
});

describe("catalog helpers", () => {
  it("gets a connector by slug and returns undefined for unknown input", () => {
    expect(getConnectorBySlug("hubspot")?.name).toBe("HubSpot");
    expect(getConnectorBySlug("not-a-connector")).toBeUndefined();
  });

  it("lists the catalog and filters across registry facets", () => {
    expect(listConnectors()).toBe(connectorCatalog);
    expect(
      filterConnectors({
        category: "calendar",
        direction: "bidirectional",
        accessPosture: "read-write",
        operation: "write",
      }).map((connector) => connector.slug),
    ).toEqual(["google-calendar", "microsoft-calendar"]);
    expect(
      filterConnectors({
        category: "payments",
        accessPosture: "read-only",
        operation: "read",
      }).map((connector) => connector.slug),
    ).toEqual(["stripe"]);
  });
});
