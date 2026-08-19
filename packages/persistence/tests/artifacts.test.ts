import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  createArtifact,
  getLatestArtifact,
  listArtifacts,
} from "../src/artifacts";
import { getTestPool, seedOrganization } from "./support";

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

    const artifact = await createArtifact(pool, org.id, input);

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

    const first = await createArtifact(
      pool,
      org.id,
      fixtureInput({ title: "First brief" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await createArtifact(
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

    await createArtifact(pool, orgB.id, fixtureInput());

    const artifact = await getLatestArtifact(pool, orgA.id, "daily_brief");

    expect(artifact).toBeNull();
  });

  it("lists an organization's artifact history newest first", async () => {
    const org = await seedOrganization(pool);

    const first = await createArtifact(
      pool,
      org.id,
      fixtureInput({ title: "First brief" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await createArtifact(
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

    await createArtifact(pool, orgB.id, fixtureInput());

    const history = await listArtifacts(pool, orgA.id, "daily_brief");

    expect(history).toEqual([]);
  });
});
