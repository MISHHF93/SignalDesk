import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Artifact } from "../src/artifacts";
import {
  createArtifact,
  getLatestArtifact,
  listArtifacts,
} from "../src/artifacts";
import type { DatabasePool } from "../src/client";
import { getTestPool, seedOrganization } from "./support";

// None of these fixtures ever set `idempotencyKey`, so `createArtifact`
// never actually returns null here — a `null` `idempotency_key` never
// conflicts with anything in Postgres. Throws instead of asserting the
// type away, so a real regression (e.g. a stray idempotencyKey creeping
// into a fixture) fails loudly rather than silently narrowing past it.
async function createArtifactOrThrow(
  ...args: Parameters<typeof createArtifact>
): Promise<Artifact> {
  const artifact = await createArtifact(...args);

  if (!artifact) {
    throw new Error(
      "createArtifact unexpectedly returned null in a test with no idempotencyKey set",
    );
  }

  return artifact;
}

function fixtureInput(
  overrides: Partial<Parameters<typeof createArtifact>[2]> = {},
) {
  return {
    type: "daily_brief" as const,
    title: "Daily Brief — Wednesday, August 19, 2026",
    content: "2 items need attention today: 1 critical, 1 high.",
    structuredData: {
      totalCount: 2,
      criticalCount: 1,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
    },
    sourceFindingIds: ["overdue-invoice:org-1:inv-1", "stuck:org-1:lead-1"],
    ...overrides,
  };
}

// Exercises createArtifact/getLatestArtifact against the live database:
// real inserts, real defaults (status/generatedBy), array/jsonb column
// round-tripping, and tenant isolation.
describe.skipIf(!process.env.DATABASE_URL)("artifacts (live database)", () => {
  let pool: DatabasePool;

  beforeAll(() => {
    pool = getTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a real artifact with the expected defaults", async () => {
    const org = await seedOrganization(pool);
    const input = fixtureInput();

    const artifact = await createArtifactOrThrow(pool, org.id, input);

    expect(artifact.organizationId).toBe(org.id);
    expect(artifact.type).toBe("daily_brief");
    expect(artifact.title).toBe(input.title);
    expect(artifact.content).toBe(input.content);
    expect(artifact.status).toBe("generated");
    expect(artifact.generatedBy).toBe("deterministic-assembly");
    expect(artifact.structuredData).toEqual(input.structuredData);
    expect(artifact.sourceFindingIds).toEqual(input.sourceFindingIds);
    expect(artifact.generatedAt).toBeInstanceOf(Date);
  });

  it("returns null when no artifact of that type exists yet", async () => {
    const org = await seedOrganization(pool);

    const artifact = await getLatestArtifact(pool, org.id, "daily_brief");

    expect(artifact).toBeNull();
  });

  it("returns the most recently generated artifact of a type", async () => {
    const org = await seedOrganization(pool);

    const first = await createArtifactOrThrow(
      pool,
      org.id,
      fixtureInput({ title: "First brief" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await createArtifactOrThrow(
      pool,
      org.id,
      fixtureInput({ title: "Second brief" }),
    );

    const latest = await getLatestArtifact(pool, org.id, "daily_brief");

    expect(latest?.id).toBe(second.id);
    expect(latest?.id).not.toBe(first.id);
    expect(latest?.title).toBe("Second brief");
  });

  it("cannot see another organization's artifacts", async () => {
    const orgA = await seedOrganization(pool);
    const orgB = await seedOrganization(pool);

    await createArtifactOrThrow(pool, orgB.id, fixtureInput());

    const artifact = await getLatestArtifact(pool, orgA.id, "daily_brief");

    expect(artifact).toBeNull();
  });

  it("lists an organization's artifact history newest first", async () => {
    const org = await seedOrganization(pool);

    const first = await createArtifactOrThrow(
      pool,
      org.id,
      fixtureInput({ title: "First brief" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await createArtifactOrThrow(
      pool,
      org.id,
      fixtureInput({ title: "Second brief" }),
    );

    const history = await listArtifacts(pool, org.id, "daily_brief");

    expect(history.map((artifact) => artifact.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it("returns an empty list when no artifact of that type exists yet", async () => {
    const org = await seedOrganization(pool);

    const history = await listArtifacts(pool, org.id, "daily_brief");

    expect(history).toEqual([]);
  });

  it("does not list another organization's artifacts", async () => {
    const orgA = await seedOrganization(pool);
    const orgB = await seedOrganization(pool);

    await createArtifactOrThrow(pool, orgB.id, fixtureInput());

    const history = await listArtifacts(pool, orgA.id, "daily_brief");

    expect(history).toEqual([]);
  });

  // Real bug found by review: the morning-brief cron's "already generated
  // today" check used to be a separate SELECT before an unconditional
  // INSERT — a non-atomic check-then-act two overlapping invocations
  // could both pass, each inserting a real duplicate brief, despite the
  // cron route's own doc comment explicitly claiming idempotency.
  // idempotencyKey (enforced unique per organization by
  // artifacts_org_idempotency_unique) is what makes that guarantee real.
  it("returns null, not a thrown error, on a real idempotency-key conflict", async () => {
    const org = await seedOrganization(pool);
    const input = fixtureInput({ idempotencyKey: "daily-brief:2026-08-26" });

    const first = await createArtifact(pool, org.id, input);
    const second = await createArtifact(pool, org.id, input);

    expect(first).not.toBeNull();
    expect(second).toBeNull();

    const history = await listArtifacts(pool, org.id, "daily_brief");
    expect(history).toHaveLength(1);
  });

  it("does not conflict across different idempotency keys for the same organization", async () => {
    const org = await seedOrganization(pool);

    const first = await createArtifactOrThrow(
      pool,
      org.id,
      fixtureInput({ idempotencyKey: "daily-brief:2026-08-25" }),
    );
    const second = await createArtifactOrThrow(
      pool,
      org.id,
      fixtureInput({ idempotencyKey: "daily-brief:2026-08-26" }),
    );

    expect(first.id).not.toBe(second.id);
  });

  it("never conflicts when idempotencyKey is omitted, even across repeated calls with identical content", async () => {
    const org = await seedOrganization(pool);
    const input = fixtureInput();

    const first = await createArtifact(pool, org.id, input);
    const second = await createArtifact(pool, org.id, input);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first?.id).not.toBe(second?.id);
  });
});
