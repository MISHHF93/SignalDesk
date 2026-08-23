import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

export interface MintCapabilityGrantInput {
  readonly collaborationId: string;
  readonly agentId: string;
  readonly capability: string;
  readonly canPropose: boolean;
  readonly ttlMs: number;
}

export interface AgentDelegationGrant {
  readonly id: string;
  readonly collaborationId: string;
  readonly agentId: string;
  readonly capability: string;
  readonly canPropose: boolean;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

interface AgentDelegationGrantRow {
  readonly id: string;
  readonly collaboration_id: string;
  readonly agent_id: string;
  readonly capability: string;
  readonly can_propose: boolean;
  readonly expires_at: Date;
  readonly created_at: Date;
}

function toGrant(row: AgentDelegationGrantRow): AgentDelegationGrant {
  return {
    id: row.id,
    collaborationId: row.collaboration_id,
    agentId: row.agent_id,
    capability: row.capability,
    canPropose: row.can_propose,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/**
 * Mints one real, time-bounded capability grant — the real session boundary
 * AgentGatewayService enforces before ever calling a provider. A fresh
 * grant per dispatch, never reused across tasks, so the delegation chain
 * stays auditable one hop at a time (docs/adr/0020-agent-fabric.md).
 */
export async function mintCapabilityGrant(
  pool: DatabasePool,
  organizationId: string,
  input: MintCapabilityGrantInput,
): Promise<AgentDelegationGrant> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<AgentDelegationGrantRow>(
      `insert into agent_delegation_grants (
         id, organization_id, collaboration_id, agent_id, capability, can_propose, expires_at
       ) values ($1, $2, $3, $4, $5, $6, now() + make_interval(secs => $7::numeric / 1000))
       returning id, collaboration_id, agent_id, capability, can_propose, expires_at, created_at`,
      [
        randomUUID(),
        organizationId,
        input.collaborationId,
        input.agentId,
        input.capability,
        input.canPropose,
        input.ttlMs,
      ],
    );

    return toGrant(result.rows[0]!);
  });
}

export class GrantExpiredError extends Error {
  constructor(grantId: string) {
    super(`Agent delegation grant expired: ${grantId}`);
    this.name = "GrantExpiredError";
  }
}

/**
 * Pure check — no I/O. Throws `GrantExpiredError` past `expiresAt` rather
 * than returning a boolean, so a caller that forgets to check fails loudly:
 * a provider call proceeding on an expired grant is a real safety bug, not
 * a value worth letting a caller silently ignore.
 */
export function assertGrantActive(
  grant: Pick<AgentDelegationGrant, "id" | "expiresAt">,
  now: Date,
): void {
  if (now.getTime() >= grant.expiresAt.getTime()) {
    throw new GrantExpiredError(grant.id);
  }
}

const MAX_RECENT_AGENT_DELEGATION_GRANTS = 25;

/**
 * The real, minted-not-declared capability grants an organization's
 * agents have actually held, newest first — the Trust Center's "granted
 * agent capability ids" section (Prompt 38, docs/product-vision-
 * backlog.md, ADR 0047). Distinct from `AgentCard.capabilities`
 * (`@signaldesk/schemas`, the static, catalog-declared list of what an
 * agent is *allowed* to request): this is every real, time-bounded grant
 * `mintCapabilityGrant` has actually issued, whether still active or
 * already expired — capped like every other "real set" list in this
 * app.
 */
export async function listRecentAgentDelegationGrants(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly AgentDelegationGrant[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<AgentDelegationGrantRow>(
      `select id, collaboration_id, agent_id, capability, can_propose, expires_at, created_at
       from agent_delegation_grants
       where organization_id = $1
       order by created_at desc
       limit ${MAX_RECENT_AGENT_DELEGATION_GRANTS}`,
      [organizationId],
    );

    return result.rows.map(toGrant);
  });
}
