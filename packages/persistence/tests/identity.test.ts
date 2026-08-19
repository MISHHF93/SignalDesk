import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  provisionIdentityAndOrganization,
  resolveOrganizationForIdentity,
} from "../src/identity";
import { getTestPool } from "./support";

// Exercises the identity-provisioning bootstrap path added in
// drizzle/0007_identity_provisioning.sql (ADR 0005): the SECURITY DEFINER
// functions that create a user's first organization and later resolve which
// organization an authenticated identity belongs to, before any tenant
// context exists.
describe.skipIf(!process.env.DATABASE_URL)("identity (live database)", () => {
  let pool: DatabasePool;

  beforeAll(() => {
    pool = getTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("provisions a user, a solo organization, and an owner membership", async () => {
    const subject = `test-subject-${randomUUID()}`;

    const result = await provisionIdentityAndOrganization(pool, {
      identityProvider: "supabase",
      identityProviderSubject: subject,
      displayName: "Ada Lovelace",
      primaryEmail: "ada@example.com",
    });

    expect(result.organizationId).toBeTruthy();
    expect(result.userId).toBeTruthy();

    // `users`/`memberships` have zero ordinary SELECT policies (by design —
    // see 0007's comment on the fail-closed RLS model), so the only
    // sanctioned way to verify the write is the same resolver a real
    // sign-in would use, not a direct table read as app_runtime.
    const membership = await resolveOrganizationForIdentity(
      pool,
      "supabase",
      subject,
    );

    expect(membership).toEqual({
      organizationId: result.organizationId,
      userId: result.userId,
      role: "owner",
      status: "active",
    });
  });

  it("resolves the organization for a provisioned identity", async () => {
    const subject = `test-subject-${randomUUID()}`;

    const provisioned = await provisionIdentityAndOrganization(pool, {
      identityProvider: "supabase",
      identityProviderSubject: subject,
      displayName: "Grace Hopper",
      primaryEmail: "grace@example.com",
    });

    const membership = await resolveOrganizationForIdentity(
      pool,
      "supabase",
      subject,
    );

    expect(membership).toEqual({
      organizationId: provisioned.organizationId,
      userId: provisioned.userId,
      role: "owner",
      status: "active",
    });
  });

  it("returns null for an identity that has never been provisioned", async () => {
    const membership = await resolveOrganizationForIdentity(
      pool,
      "supabase",
      `never-provisioned-${randomUUID()}`,
    );

    expect(membership).toBeNull();
  });
});
