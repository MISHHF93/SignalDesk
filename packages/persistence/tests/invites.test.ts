import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { provisionIdentityAndOrganization } from "../src/identity";
import {
  createOrganizationInvite,
  listOrganizationInvites,
  revokeOrganizationInvite,
  validateInviteToken,
} from "../src/invites";
import { withTenantContext } from "../src/tenant-context";
import { getTestPool, seedMembership } from "./support";

// Exercises the real Phase 3 multi-member invite flow end to end against
// the live database: create → validate → accept (via
// provisionIdentityAndOrganization, the same function every real signup
// already calls) → real second membership in the SAME organization, not a
// new one — plus revoke and cross-tenant isolation.
describe.skipIf(!process.env.DATABASE_URL)(
  "organization invites (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real pending invite and returns a usable token", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const email = `invitee-${randomUUID()}@example.test`;

      const { invite, token } = await createOrganizationInvite(
        pool,
        organizationId,
        userId,
        { email, role: "member" },
      );

      expect(invite.email).toBe(email.toLowerCase());
      expect(invite.role).toBe("member");
      expect(invite.status).toBe("pending");
      expect(token).toHaveLength(36); // a real UUID
    });

    it("normalizes email casing at write time", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const rawEmail = `Mixed-Case-${randomUUID()}@Example.Test`;

      const { invite } = await createOrganizationInvite(
        pool,
        organizationId,
        userId,
        { email: rawEmail, role: "viewer" },
      );

      expect(invite.email).toBe(rawEmail.toLowerCase());
    });

    it("lists real invites for an organization, newest first", async () => {
      const { organizationId, userId } = await seedMembership(pool);

      const first = await createOrganizationInvite(
        pool,
        organizationId,
        userId,
        {
          email: `a-${randomUUID()}@example.test`,
          role: "member",
        },
      );
      const second = await createOrganizationInvite(
        pool,
        organizationId,
        userId,
        {
          email: `b-${randomUUID()}@example.test`,
          role: "admin",
        },
      );

      const invites = await listOrganizationInvites(pool, organizationId);

      expect(invites.map((i) => i.id)).toEqual([
        second.invite.id,
        first.invite.id,
      ]);
    });

    it("cannot see another organization's invites", async () => {
      const orgA = await seedMembership(pool);
      const orgB = await seedMembership(pool);

      await createOrganizationInvite(pool, orgA.organizationId, orgA.userId, {
        email: `isolated-${randomUUID()}@example.test`,
        role: "member",
      });

      const invitesForB = await listOrganizationInvites(
        pool,
        orgB.organizationId,
      );

      expect(invitesForB).toHaveLength(0);
    });

    it("validates a real pending token pre-authentication and rejects an unknown one", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const email = `preview-${randomUUID()}@example.test`;

      const { token } = await createOrganizationInvite(
        pool,
        organizationId,
        userId,
        { email, role: "admin" },
      );

      const preview = await validateInviteToken(pool, token);

      expect(preview).toEqual({
        organizationId,
        organizationName: expect.any(String),
        email,
        role: "admin",
      });

      const unknown = await validateInviteToken(pool, "not-a-real-token");
      expect(unknown).toBeNull();
    });

    it("revokes a pending invite; a revoked token no longer validates", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const { invite, token } = await createOrganizationInvite(
        pool,
        organizationId,
        userId,
        { email: `revoke-me-${randomUUID()}@example.test`, role: "member" },
      );

      const revoked = await revokeOrganizationInvite(
        pool,
        organizationId,
        invite.id,
      );
      expect(revoked).toBe(true);

      const preview = await validateInviteToken(pool, token);
      expect(preview).toBeNull();

      // Revoking an already-revoked invite is a no-op, not an error.
      const revokedAgain = await revokeOrganizationInvite(
        pool,
        organizationId,
        invite.id,
      );
      expect(revokedAgain).toBe(false);
    });

    it("accepting a real invite joins the SAME organization with the invited role, not a new one", async () => {
      const inviter = await seedMembership(pool);
      const email = `accepted-${randomUUID()}@example.test`;

      const { token } = await createOrganizationInvite(
        pool,
        inviter.organizationId,
        inviter.userId,
        { email, role: "admin" },
      );

      const { organizationId: resultOrgId, userId: newUserId } =
        await provisionIdentityAndOrganization(pool, {
          identityProvider: "test",
          identityProviderSubject: `subject-${randomUUID()}`,
          displayName: "Accepted Invitee",
          primaryEmail: email,
          inviteToken: token,
        });

      // The real, load-bearing assertion: joined the INVITER's organization,
      // not a fresh solo one.
      expect(resultOrgId).toBe(inviter.organizationId);

      const [membershipRow, inviteRow] = await withTenantContext(
        pool,
        inviter.organizationId,
        async (client) => {
          const membership = await client.query(
            `select role, status from memberships where organization_id = $1 and user_id = $2`,
            [inviter.organizationId, newUserId],
          );
          const invite = await client.query(
            `select status, accepted_at from organization_invites where token = $1`,
            [token],
          );
          return [membership.rows[0], invite.rows[0]];
        },
      );

      expect(membershipRow).toEqual({ role: "admin", status: "active" });
      expect(inviteRow.status).toBe("accepted");
      expect(inviteRow.accepted_at).not.toBeNull();

      const invitesAfterAccept = await listOrganizationInvites(
        pool,
        inviter.organizationId,
      );
      expect(invitesAfterAccept.find((i) => i.email === email)?.status).toBe(
        "accepted",
      );
    });

    it("a mismatched email never accepts the invite — provisions a normal solo org instead", async () => {
      const inviter = await seedMembership(pool);
      const { token } = await createOrganizationInvite(
        pool,
        inviter.organizationId,
        inviter.userId,
        { email: `intended-${randomUUID()}@example.test`, role: "member" },
      );

      const wrongEmail = `wrong-${randomUUID()}@example.test`;
      const { organizationId: resultOrgId } =
        await provisionIdentityAndOrganization(pool, {
          identityProvider: "test",
          identityProviderSubject: `subject-${randomUUID()}`,
          displayName: "Wrong Person",
          primaryEmail: wrongEmail,
          inviteToken: token,
        });

      // A real, new, independent solo organization — never the inviter's.
      expect(resultOrgId).not.toBe(inviter.organizationId);

      // Still pending and valid — a mismatched email never consumed it.
      const preview = await validateInviteToken(pool, token);
      expect(preview).not.toBeNull();
    });

    it("an expired invite never accepts — the recipient gets a normal solo org", async () => {
      const inviter = await seedMembership(pool);
      const email = `expired-${randomUUID()}@example.test`;
      const { token } = await createOrganizationInvite(
        pool,
        inviter.organizationId,
        inviter.userId,
        { email, role: "member" },
      );

      // Directly backdate expiry — the real function only exposes a fixed
      // 7-day window, so this is the one honest way to test the boundary.
      await withTenantContext(pool, inviter.organizationId, async (client) => {
        await client.query(
          `update organization_invites set expires_at = now() - interval '1 minute' where token = $1`,
          [token],
        );
      });

      const { organizationId: resultOrgId } =
        await provisionIdentityAndOrganization(pool, {
          identityProvider: "test",
          identityProviderSubject: `subject-${randomUUID()}`,
          displayName: "Too Late",
          primaryEmail: email,
          inviteToken: token,
        });

      expect(resultOrgId).not.toBe(inviter.organizationId);

      const preview = await validateInviteToken(pool, token);
      expect(preview).toBeNull();
    });
  },
);
