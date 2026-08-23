import { describe, expect, it } from "vitest";

import {
  computeBusinessCoverageByCapability,
  computeIndustryCoverage,
  connectorCapabilityClasses,
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
  "salesforce",
  "pipedrive",
  "microsoft-teams",
  "clickup",
  "monday-com",
  "teamwork",
  "jira",
  "github",
  "xero",
  "dropbox",
  "google-drive",
  "sharepoint",
  "zendesk",
  "intercom",
  "docusign",
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
    expect(slack?.capabilityClasses).toEqual(["communication"]);
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

  it("declares at least one valid capability class for every connector", () => {
    for (const connector of connectorCatalog) {
      expect(connector.capabilityClasses.length).toBeGreaterThan(0);
      for (const capabilityClass of connector.capabilityClasses) {
        expect(connectorCapabilityClasses).toContain(capabilityClass);
      }
    }
  });

  it("spot-checks capability class assignment for newly added connectors", () => {
    expect(getConnectorBySlug("docusign")?.capabilityClasses).toEqual([
      "contracts",
    ]);
    expect(getConnectorBySlug("zendesk")?.capabilityClasses).toEqual([
      "support",
    ]);
    expect(getConnectorBySlug("github")?.capabilityClasses).toEqual([
      "projects",
    ]);
    expect(getConnectorBySlug("salesforce")?.capabilityClasses).toEqual([
      "crm",
    ]);
  });

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
    "salesforce",
    "xero",
    "jira",
    "zendesk",
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

  // The only eight connectors with a real one-time sync-on-connect into
  // the Business Graph (HubSpot deals→leads, QuickBooks invoices, Asana
  // tasks, Gmail messages as of Phase 4b, Salesforce opportunities→leads,
  // Xero invoices, Jira issues→tasks, Zendesk tickets→support_tickets) —
  // everything else authenticates but moves no data yet.
  const initialSyncSlugs: ReadonlySet<ConnectorSlug> = new Set([
    "hubspot",
    "quickbooks",
    "asana",
    "gmail",
    "salesforce",
    "xero",
    "jira",
    "zendesk",
  ]);

  // QuickBooks (ADR 0022), HubSpot (ADR 0023), Asana (ADR 0024), Gmail
  // (Phase 4b, implementation roadmap), Salesforce (filtered by
  // `LastModifiedDate` in its SOQL WHERE clause), Xero (filtered via the
  // `If-Modified-Since` header), Jira (filtered via a JQL
  // `updated > "..."` clause, Jira's own quoted date-literal format), and
  // Zendesk (filtered via its own cursor-based incremental export
  // endpoint) are the only connectors whose fetch is actually filtered by
  // the stored sync cursor on incremental runs — every other connector's
  // "Sync Now" still always pulls the full set.
  const incrementalSyncSlugs: ReadonlySet<ConnectorSlug> = new Set([
    "quickbooks",
    "hubspot",
    "asana",
    "gmail",
    "salesforce",
    "xero",
    "jira",
    "zendesk",
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
        incrementalSyncImplemented: incrementalSyncSlugs.has(slug),
        actionsImplemented: false,
        productionReady: false,
      });
    },
  );

  it("reports every planned connector's not-configured readiness honestly", () => {
    const plannedConnectors = filterConnectors({ availability: "planned" });

    expect(plannedConnectors.length).toBe(11);

    for (const connector of plannedConnectors) {
      expect(connector.authStrategy.configuration).toBe("not-configured");
      expect(connector.authStrategy.scopesDefined).toBe(false);
      expect(connector.readiness).toEqual({
        catalogMetadata: true,
        adapterImplemented: false,
        authorizationImplemented: false,
        syncImplemented: false,
        initialSyncImplemented: false,
        incrementalSyncImplemented: false,
        actionsImplemented: false,
        productionReady: false,
      });
    }
  });

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

describe("computeBusinessCoverageByCapability", () => {
  it("reports every class as unconnected when nothing is connected", () => {
    const coverage = computeBusinessCoverageByCapability([]);

    expect(coverage.length).toBeGreaterThan(0);
    expect(coverage.every((entry) => entry.status === "none")).toBe(true);
    expect(
      coverage.every((entry) => entry.connectedConnectorNames.length === 0),
    ).toBe(true);
  });

  it("reports a single-connector class as fully connected, by name", () => {
    const coverage = computeBusinessCoverageByCapability(["stripe"]);
    const payments = coverage.find(
      (entry) => entry.capabilityClass === "payments",
    );

    expect(payments).toEqual({
      capabilityClass: "payments",
      status: "connected",
      connectedConnectorNames: ["Stripe"],
      totalConnectorNames: ["Stripe"],
    });
  });

  it("reports a multi-connector class as partial when only one is connected", () => {
    const coverage = computeBusinessCoverageByCapability(["hubspot"]);
    const crm = coverage.find((entry) => entry.capabilityClass === "crm");

    expect(crm?.status).toBe("partial");
    expect(crm?.connectedConnectorNames).toEqual(["HubSpot"]);
    expect(crm?.totalConnectorNames).toEqual([
      "HubSpot",
      "Salesforce",
      "Pipedrive",
    ]);
  });

  it("attributes a connector to every capability class it declares", () => {
    // No cataloged connector declares more than one class today, but the
    // aggregation itself must handle it — a synthetic multi-class check
    // via the real catalog's communication class (4 connectors) confirms
    // the loop iterates every declared class, not just the first.
    const coverage = computeBusinessCoverageByCapability(["gmail"]);
    const communication = coverage.find(
      (entry) => entry.capabilityClass === "communication",
    );

    expect(communication?.status).toBe("partial");
    expect(communication?.connectedConnectorNames).toEqual(["Gmail"]);
    expect(communication?.totalConnectorNames).toEqual([
      "Slack",
      "Gmail",
      "Microsoft Outlook",
      "Microsoft Teams",
    ]);
  });
});

describe("computeIndustryCoverage", () => {
  it("returns null for the unspecified industry", () => {
    expect(computeIndustryCoverage("unspecified", [])).toBeNull();
  });

  it("returns null for an unknown industry string", () => {
    expect(computeIndustryCoverage("not-a-real-industry", [])).toBeNull();
  });

  it("returns only the recommended classes for professional_services, nothing connected", () => {
    const coverage = computeIndustryCoverage("professional_services", []);

    expect(coverage?.industry).toBe("professional_services");
    expect(coverage?.recommended.map((entry) => entry.capabilityClass)).toEqual(
      ["crm", "projects", "accounting", "communication"],
    );
    expect(
      coverage?.recommended.every((entry) => entry.status === "none"),
    ).toBe(true);
  });

  it("reflects real connection state in the recommended subset", () => {
    const coverage = computeIndustryCoverage("professional_services", [
      "hubspot",
      "quickbooks",
    ]);
    const crm = coverage?.recommended.find(
      (entry) => entry.capabilityClass === "crm",
    );
    const accounting = coverage?.recommended.find(
      (entry) => entry.capabilityClass === "accounting",
    );

    // Both are "partial", not "connected" — each class now has more than
    // one cataloged connector (crm: HubSpot/Salesforce/Pipedrive;
    // accounting: QuickBooks/Xero), confirming this reflects real
    // multi-connector coverage, not just a single-entry passthrough.
    expect(crm?.status).toBe("partial");
    expect(crm?.connectedConnectorNames).toEqual(["HubSpot"]);
    expect(accounting?.status).toBe("partial");
    expect(accounting?.connectedConnectorNames).toEqual(["QuickBooks"]);
    // "payments" isn't a recommended class for this industry, even though
    // it's a real class in the catalog — confirms filtering, not just
    // passthrough of computeBusinessCoverageByCapability's full output.
    expect(
      coverage?.recommended.some(
        (entry) => entry.capabilityClass === "payments",
      ),
    ).toBe(false);
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
        capabilityClass: "calendar",
        direction: "bidirectional",
        accessPosture: "read-write",
        operation: "write",
      }).map((connector) => connector.slug),
    ).toEqual(["google-calendar", "microsoft-calendar"]);
    expect(
      filterConnectors({
        capabilityClass: "payments",
        accessPosture: "read-only",
        operation: "read",
      }).map((connector) => connector.slug),
    ).toEqual(["stripe"]);
  });
});
