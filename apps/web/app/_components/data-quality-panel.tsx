import type { DataQualityIssue } from "@signaldesk/data-quality";

function labelForEntity(
  entity: DataQualityIssue["entities"][number],
  connectorName: (system: string) => string,
): string {
  const kindLabel = entity.kind === "invoice" ? "Invoice" : "Lead";
  return `${kindLabel} in ${connectorName(entity.system)}`;
}

/**
 * Renders the one real `DataQualityIssue` type this app produces today
 * (Prompt 33, docs/product-vision-backlog.md, ADR 0042): an invoice
 * customer name and a lead company name that match exactly across two
 * different connected systems, surfaced for human review only — no merge
 * action exists yet, matching the honesty discipline that no button may
 * imply a backend process that doesn't exist.
 */
export function DataQualityPanel({
  issues,
  connectorName,
}: {
  readonly issues: readonly DataQualityIssue[];
  readonly connectorName: (system: string) => string;
}) {
  return (
    <section
      className="csvImportSection"
      aria-labelledby="data-quality-heading"
    >
      <p className="sectionKicker">Data quality</p>
      <h2 id="data-quality-heading">Possible duplicate records</h2>
      <p>
        A real check: an invoice customer name and a lead company name that
        match exactly across two different connected systems — a likely sign
        they&rsquo;re the same business tracked twice, even though there&rsquo;s
        nothing linking them together yet.
      </p>

      {issues.length === 0 ? (
        <p className="dataQualityMeta">
          No exact-match duplicates found across your connected systems right
          now.
        </p>
      ) : (
        <ul className="dataQualityIssueList">
          {issues.map((issue) => (
            <li key={issue.id} className="dataQualityIssue">
              <p className="dataQualityIssueName">
                &ldquo;{issue.matchedOn}&rdquo;
              </p>
              <p className="dataQualityIssueEntities">
                {labelForEntity(issue.entities[0], connectorName)} ↔{" "}
                {labelForEntity(issue.entities[1], connectorName)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
