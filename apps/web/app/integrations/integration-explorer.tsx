"use client";

import type {
  ConnectorCapabilityClass,
  ConnectorDefinition,
} from "@signaldesk/integrations";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ConnectorMark } from "../_components/connector-mark";
import { capabilityClassLabels } from "../_lib/connector-labels";

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
  const [capabilityClass, setCapabilityClass] = useState<
    ConnectorCapabilityClass | "all"
  >("all");
  const capabilityClasses = useMemo(
    () =>
      Array.from(
        new Set(connectors.flatMap((connector) => connector.capabilityClasses)),
      ),
    [connectors],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredConnectors = useMemo(
    () =>
      connectors.filter((connector) => {
        const matchesCapabilityClass =
          capabilityClass === "all" ||
          connector.capabilityClasses.includes(capabilityClass);
        const searchText = [
          connector.name,
          connector.shortDescription,
          ...connector.capabilityClasses.map(
            (entry) => capabilityClassLabels[entry],
          ),
          ...connector.capabilities.map((capability) => capability.label),
        ]
          .join(" ")
          .toLocaleLowerCase();

        return matchesCapabilityClass && searchText.includes(normalizedQuery);
      }),
    [capabilityClass, connectors, normalizedQuery],
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
          aria-label="Filter by business capability"
        >
          <button
            aria-pressed={capabilityClass === "all"}
            onClick={() => setCapabilityClass("all")}
            type="button"
          >
            All
          </button>
          {capabilityClasses.map((item) => (
            <button
              aria-pressed={capabilityClass === item}
              key={item}
              onClick={() => setCapabilityClass(item)}
              type="button"
            >
              {capabilityClassLabels[item]}
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
                  {capabilityClassLabels[connector.capabilityClasses[0]!]}
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
              setCapabilityClass("all");
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
