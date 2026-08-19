import type { ConnectorDefinition } from "@signaldesk/integrations";

import { ConnectorIcon } from "./connector-icons";

export function ConnectorMark({
  connector,
  size = "default",
}: {
  connector: ConnectorDefinition;
  size?: "default" | "large";
}) {
  return (
    <span
      aria-hidden="true"
      className={`connectorMark ${size === "large" ? "largeConnectorMark" : ""}`}
      data-connector={connector.slug}
    >
      <ConnectorIcon connector={connector} />
    </span>
  );
}
