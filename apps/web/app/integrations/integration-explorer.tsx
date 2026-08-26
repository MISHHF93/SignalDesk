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
  if (direction === "inbound") return "Brings data in";
  if (direction === "outbound") return "Sends data out";
  return "Two-way sync";
}

/** The one real connector card — shared by both the Connected and Not-yet-
 * connected sections below rather than duplicated per section. */
function ConnectorCard({ connector }: { connector: ConnectorDefinition }) {
  return (
    <article
      className={`connectorCard ${connector.slug === "slack" ? "featuredConnector" : ""}`}
    >
      <div className="connectorCardTop">
        <ConnectorMark connector={connector} />
        <span
          className={`availabilityBadge ${connector.availability === "foundation-preview" ? "preview" : "planned"}`}
        >
          {connector.availability === "foundation-preview"
            ? "In progress"
            : "Coming soon"}
        </span>
      </div>

      <p className="connectorCategory">
        {capabilityClassLabels[connector.capabilityClasses[0]!]}
      </p>
      <h3>{connector.name}</h3>
      <p className="connectorDescription">{connector.shortDescription}</p>

      <ul className="capabilityPreview" aria-label="Designed capabilities">
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
            ? "Read-only"
            : "Can also take approved actions"}
        </span>
      </div>

      <Link className="connectorLink" href={`/integrations/${connector.slug}`}>
        Review setup
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

export function IntegrationExplorer({
  connectors,
  connectedSlugs,
}: {
  connectors: readonly ConnectorDefinition[];
  /** Real, currently active/degraded source systems for this organization
   * (`listActiveIntegrationSourceSystems`) — an empty array for a guest or
   * signed-out visitor, never a guess. Drives the Connected/Not-yet-
   * connected split below; unrelated to `connector.availability`
   * (foundation-preview/planned), which is about whether the catalog
   * entry is real at all, not whether *this* organization uses it. */
  connectedSlugs: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const [capabilityClass, setCapabilityClass] = useState<
    ConnectorCapabilityClass | "all"
  >("all");
  const connectedSlugSet = useMemo(
    () => new Set(connectedSlugs),
    [connectedSlugs],
  );
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
  const connectedConnectors = useMemo(
    () =>
      filteredConnectors.filter((connector) =>
        connectedSlugSet.has(connector.slug),
      ),
    [connectedSlugSet, filteredConnectors],
  );
  const notConnectedConnectors = useMemo(
    () =>
      filteredConnectors.filter(
        (connector) => !connectedSlugSet.has(connector.slug),
      ),
    [connectedSlugSet, filteredConnectors],
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
        <>
          {connectedConnectors.length > 0 ? (
            <div className="connectorGroup">
              <h3 className="connectorGroupHeading">
                Connected
                <span>{connectedConnectors.length}</span>
              </h3>
              <ul className="connectorGrid">
                {connectedConnectors.map((connector) => (
                  <li key={connector.slug}>
                    <ConnectorCard connector={connector} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {notConnectedConnectors.length > 0 ? (
            // Collapsed by default once the organization has at least one
            // real connection — that's when decluttering the other ~20
            // catalog entries actually helps. A brand-new org with zero
            // connections has nothing to declutter *from*, so this starts
            // open rather than hiding the entire catalog on first visit.
            // `connectedSlugs.length` (not the filtered count) drives this,
            // so typing a search query never flips it shut mid-search.
            <details
              className="connectorGroupDisclosure"
              open={connectedSlugs.length === 0}
            >
              <summary>
                Not yet connected
                <span>{notConnectedConnectors.length}</span>
              </summary>
              <ul className="connectorGrid">
                {notConnectedConnectors.map((connector) => (
                  <li key={connector.slug}>
                    <ConnectorCard connector={connector} />
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
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
