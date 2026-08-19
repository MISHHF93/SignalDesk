"use client";

import type {
  ConnectorDefinition,
  ConnectorPurpose,
} from "@business-dashboard/integrations";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ConnectorMark } from "../_components/connector-mark";
import { purposeLabels } from "../_lib/connector-labels";

function directionLabel(direction: ConnectorDefinition["direction"]): string {
  if (direction === "inbound") return "Inbound design";
  if (direction === "outbound") return "Outbound design";
  return "Two-way design";
}

export function IntegrationExplorer({
  connectors,
}: {
  connectors: readonly ConnectorDefinition[];
}) {
  const [query, setQuery] = useState("");
  const [purpose, setPurpose] = useState<ConnectorPurpose | "all">("all");
  const purposes = useMemo(
    () => Array.from(new Set(connectors.map((connector) => connector.purpose))),
    [connectors],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredConnectors = useMemo(
    () =>
      connectors.filter((connector) => {
        const matchesPurpose =
          purpose === "all" || connector.purpose === purpose;
        const searchText = [
          connector.name,
          connector.shortDescription,
          purposeLabels[connector.purpose],
          ...connector.capabilities.map((capability) => capability.label),
        ]
          .join(" ")
          .toLocaleLowerCase();

        return matchesPurpose && searchText.includes(normalizedQuery);
      }),
    [purpose, connectors, normalizedQuery],
  );

  return (
    <section
      className="catalogSection"
      aria-labelledby="connector-catalog-heading"
    >
      <div className="catalogHeading">
        <div>
          <p className="sectionKicker">Connector catalog</p>
          <h2 id="connector-catalog-heading">Explore the integration hub</h2>
        </div>
        <p aria-live="polite" aria-atomic="true">
          {filteredConnectors.length} of {connectors.length} connectors
        </p>
      </div>

      <div className="integrationFilters">
        <label className="integrationSearch" htmlFor="connector-search">
          <span>Search connectors</span>
          <span className="searchField">
            <svg aria-hidden="true" viewBox="0 0 20 20">
              <circle cx="8.5" cy="8.5" r="4.8" fill="none" />
              <path d="m12.2 12.2 4 4" />
            </svg>
            <input
              id="connector-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Slack, payments, calendar…"
              type="search"
              value={query}
            />
          </span>
        </label>

        <div
          className="categoryFilters"
          role="group"
          aria-label="Filter by business purpose"
        >
          <button
            aria-pressed={purpose === "all"}
            onClick={() => setPurpose("all")}
            type="button"
          >
            All
          </button>
          {purposes.map((item) => (
            <button
              aria-pressed={purpose === item}
              key={item}
              onClick={() => setPurpose(item)}
              type="button"
            >
              {purposeLabels[item]}
            </button>
          ))}
        </div>
      </div>

      {filteredConnectors.length > 0 ? (
        <ul className="connectorGrid">
          {filteredConnectors.map((connector) => (
            <li key={connector.slug}>
              <article
                className={`connectorCard ${connector.slug === "slack" ? "featuredConnector" : ""}`}
              >
                <div className="connectorCardTop">
                  <ConnectorMark connector={connector} />
                  <span
                    className={`availabilityBadge ${connector.availability === "foundation-preview" ? "preview" : "planned"}`}
                  >
                    {connector.availability === "foundation-preview"
                      ? "Foundation preview"
                      : "Planned"}
                  </span>
                </div>

                <p className="connectorCategory">
                  {purposeLabels[connector.purpose]}
                </p>
                <h3>{connector.name}</h3>
                <p className="connectorDescription">
                  {connector.shortDescription}
                </p>

                <ul
                  className="capabilityPreview"
                  aria-label="Designed capabilities"
                >
                  {connector.capabilities.map((capability) => (
                    <li key={capability.id}>
                      <span aria-hidden="true">◇</span>
                      {capability.label}
                    </li>
                  ))}
                </ul>

                <div className="connectorMeta">
                  <span>{directionLabel(connector.direction)}</span>
                  <span>
                    {connector.accessPosture === "read-only"
                      ? "Read-only intent"
                      : "Governed write intent"}
                  </span>
                </div>

                <Link
                  className="connectorLink"
                  href={`/integrations/${connector.slug}`}
                >
                  Review setup
                  <span aria-hidden="true">→</span>
                </Link>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <div className="emptyCatalog" role="status">
          <h3>No connectors match those filters</h3>
          <p>Try another search term or select a different category.</p>
          <button
            onClick={() => {
              setQuery("");
              setPurpose("all");
            }}
            type="button"
          >
            Clear filters
          </button>
        </div>
      )}
    </section>
  );
}
