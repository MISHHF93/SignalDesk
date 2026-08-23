import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { provisionIdentityAndOrganization } from "../src/identity";
import { createOrganizationInvite } from "../src/invites";
import { listOrganizationMembers } from "../src/membership";
import { getTestPool, seedMembership } from "./support";

describe.skipIf(!process.env.DATABASE_URL)(
  "listOrganizationMembers (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("lists the single auto-provisioned owner for a fresh organization", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      const members = await listOrganizationMembers(pool, organizationId);

      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({
        userId,
        role: "owner",
        status: "active",
      });
    });

    it("shows a real second member after a real invite is accepted", async () => {
      const inviter = await seedMembership(pool);
      const email = `roster-${randomUUID()}@example.test`;

      const { token } = await createOrganizationInvite(
        pool,
        inviter.organizationId,
        inviter.userId,
        { email, role: "admin" },
      );

      await provisionIdentityAndOrganization(pool, {
        identityProvider: "test",
        identityProviderSubject: `subject-${randomUUID()}`,
        displayName: "Second Member",
        primaryEmail: email,
        inviteToken: token,
      });

      const members = await listOrganizationMembers(
        pool,
        inviter.organizationId,
      );

      expect(members).toHaveLength(2);
      expect(members.map((m) => m.role).sort()).toEqual(["admin", "owner"]);
    });

    it("cannot see another organization's members", async () => {
      const orgA = await seedMembership(pool);
      const orgB = await seedMembership(pool);

      const membersOfA = await listOrganizationMembers(
        pool,
        orgA.organizationId,
      );

      expect(membersOfA.every((m) => m.userId !== orgB.userId)).toBe(true);
    });
  },
);
