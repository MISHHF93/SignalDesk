import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  completeDeferredIdentityProvisioning,
  provisionIdentityAndOrganization,
  provisionPendingIdentity,
  resolveOrganizationForIdentity,
} from "../src/identity";
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
        userId,
        invite.id,
      );
      expect(revoked).toBe(true);

      const preview = await validateInviteToken(pool, token);
      expect(preview).toBeNull();

      // Revoking an already-revoked invite is a no-op, not an error.
      const revokedAgain = await revokeOrganizationInvite(
        pool,
        organizationId,
        userId,
        invite.id,
      );
      expect(revokedAgain).toBe(false);
    });

    // Real gap found by review: createOrganizationInvite/
    // revokeOrganizationInvite used to leave their audit event to a
    // separate call in the calling Server Action, after this function's
    // own transaction already committed — unlike this package's
    // established same-transaction pattern for a policy-relevant write
    // (updateOrganizationBusinessProfile/updateConnectorSettings/
    // createGoal). These exercise the real, fixed behavior directly.
    it("records a real audit event in the same transaction as the invite creation", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const email = `audited-${randomUUID()}@example.test`;

      const { invite } = await createOrganizationInvite(
        pool,
        organizationId,
        userId,
        { email, role: "admin" },
      );

      const auditRow = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select event_type, outcome, subject_id from audit_events where event_type = 'invite.created' and subject_id = $1",
            [invite.id],
          );
          return result.rows[0];
        },
      );

      expect(auditRow).toEqual({
        event_type: "invite.created",
        outcome: "succeeded",
        subject_id: invite.id,
      });
    });

    it("records a real audit event in the same transaction as the invite revocation, with the honest revoked outcome", async () => {
      const { organizationId, userId } = await seedMembership(pool);
      const { invite } = await createOrganizationInvite(
        pool,
        organizationId,
        userId,
        {
          email: `audited-revoke-${randomUUID()}@example.test`,
          role: "member",
        },
      );

      await revokeOrganizationInvite(pool, organizationId, userId, invite.id);

      const auditRow = await withTenantContext(
        pool,
        organizationId,
        async (client) => {
          const result = await client.query(
            "select event_type, outcome, metadata from audit_events where event_type = 'invite.revoked' and subject_id = $1",
            [invite.id],
          );
          return result.rows[0];
        },
      );

      expect(auditRow).toEqual({
        event_type: "invite.revoked",
        outcome: "succeeded",
        metadata: { revoked: true },
      });
    });

    it("rolls back the revocation too when the audit write fails, rather than leaving an unaudited change committed", async () => {
      const inviter = await seedMembership(pool);
      const { invite } = await createOrganizationInvite(
        pool,
        inviter.organizationId,
        inviter.userId,
        { email: `no-rollback-${randomUUID()}@example.test`, role: "member" },
      );

      // No real membership exists for this user id in this org, so the
      // audit insert's own `resolveMembershipId` throws — proving the
      // revocation above it in the same transaction is rolled back too,
      // not left committed with a missing audit trail.
      await expect(
        revokeOrganizationInvite(
          pool,
          inviter.organizationId,
          "00000000-0000-0000-0000-000000000000",
          invite.id,
        ),
      ).rejects.toThrow(/No membership found/);

      const status = await withTenantContext(
        pool,
        inviter.organizationId,
        async (client) => {
          const result = await client.query<{ status: string }>(
            "select status from organization_invites where id = $1",
            [invite.id],
          );
          return result.rows[0]?.status;
        },
      );

      expect(status).toBe("pending");
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

    // P1 fix (ISSUES-REMAINING.md, drizzle/0071): a pending invite used to
    // be marked 'accepted' the instant a signup was submitted, before
    // email confirmation — permanently burning it even if that signup was
    // never confirmed. These exercise the real deferred path directly,
    // the same way the tests above exercise provisionIdentityAndOrganization
    // directly rather than the auth.users trigger itself (no ordinary way
    // to simulate Supabase Auth's own confirmation UPDATE from here).
    describe("deferred invite acceptance (post-confirmation)", () => {
      it("regression: an abandoned signup never consumes the invite — it stays pending for the real invitee", async () => {
        const inviter = await seedMembership(pool);
        const email = `deferred-${randomUUID()}@example.test`;
        const { token } = await createOrganizationInvite(
          pool,
          inviter.organizationId,
          inviter.userId,
          { email, role: "member" },
        );

        // Mirrors what handle_new_auth_user() now does for an unconfirmed
        // signup carrying an invite token: create only the user row.
        await provisionPendingIdentity(pool, {
          identityProvider: "test",
          identityProviderSubject: `subject-${randomUUID()}`,
          displayName: "Never Confirmed",
          primaryEmail: email,
        });

        // The real, load-bearing assertion: the invite is untouched —
        // still pending, still usable — because confirmation never
        // happened. This is exactly the state the old, unfixed trigger
        // could never reach: it accepted the invite unconditionally at
        // signup time, before any confirmation.
        const preview = await validateInviteToken(pool, token);
        expect(preview).not.toBeNull();
        expect(preview?.email).toBe(email);
      });

      it("confirming a deferred signup with a still-valid invite joins the SAME organization, mirroring immediate acceptance", async () => {
        const inviter = await seedMembership(pool);
        const email = `deferred-confirmed-${randomUUID()}@example.test`;
        const subject = `subject-${randomUUID()}`;
        const { token } = await createOrganizationInvite(
          pool,
          inviter.organizationId,
          inviter.userId,
          { email, role: "admin" },
        );

        const userId = await provisionPendingIdentity(pool, {
          identityProvider: "test",
          identityProviderSubject: subject,
          displayName: "Confirms Later",
          primaryEmail: email,
        });

        // Mirrors what handle_auth_user_confirmed() does on the real
        // email_confirmed_at transition.
        await completeDeferredIdentityProvisioning(pool, {
          userId,
          inviteToken: token,
          displayName: "Confirms Later",
        });

        const membership = await resolveOrganizationForIdentity(
          pool,
          "test",
          subject,
        );

        expect(membership).toEqual({
          organizationId: inviter.organizationId,
          userId,
          role: "admin",
          status: "active",
        });

        const preview = await validateInviteToken(pool, token);
        expect(preview).toBeNull(); // accepted, no longer a valid pending token
      });

      it("confirming a deferred signup whose invite expired before confirmation falls back to a solo organization, not a broken no-org state", async () => {
        const inviter = await seedMembership(pool);
        const email = `deferred-expired-${randomUUID()}@example.test`;
        const subject = `subject-${randomUUID()}`;
        const { token } = await createOrganizationInvite(
          pool,
          inviter.organizationId,
          inviter.userId,
          { email, role: "member" },
        );

        const userId = await provisionPendingIdentity(pool, {
          identityProvider: "test",
          identityProviderSubject: subject,
          displayName: "Too Slow",
          primaryEmail: email,
        });

        // The invite expires (or is revoked) in the window between
        // signup and confirmation — a real, reachable case this fix must
        // not leave the now-confirmed user stranded with no organization.
        await withTenantContext(
          pool,
          inviter.organizationId,
          async (client) => {
            await client.query(
              `update organization_invites set expires_at = now() - interval '1 minute' where token = $1`,
              [token],
            );
          },
        );

        await completeDeferredIdentityProvisioning(pool, {
          userId,
          inviteToken: token,
          displayName: "Too Slow",
        });

        const membership = await resolveOrganizationForIdentity(
          pool,
          "test",
          subject,
        );

        expect(membership?.organizationId).not.toBe(inviter.organizationId);
        expect(membership?.role).toBe("owner");
        expect(membership?.status).toBe("active");
      });

      it("regression: is idempotent — completing an already-provisioned user's confirmation a second time is a safe no-op, not a duplicate organization", async () => {
        const email = `deferred-idempotent-${randomUUID()}@example.test`;
        const subject = `subject-${randomUUID()}`;

        const userId = await provisionPendingIdentity(pool, {
          identityProvider: "test",
          identityProviderSubject: subject,
          displayName: "Double Fire",
          primaryEmail: email,
        });

        await completeDeferredIdentityProvisioning(pool, {
          userId,
          inviteToken: null,
          displayName: "Double Fire",
        });

        const firstMembership = await resolveOrganizationForIdentity(
          pool,
          "test",
          subject,
        );

        // A second call (e.g. the confirmation trigger somehow firing
        // twice) must not create a second organization for the same user.
        await completeDeferredIdentityProvisioning(pool, {
          userId,
          inviteToken: null,
          displayName: "Double Fire",
        });

        const secondMembership = await resolveOrganizationForIdentity(
          pool,
          "test",
          subject,
        );

        expect(secondMembership).toEqual(firstMembership);
      });

      it("a mismatched email at confirmation time still never accepts the invite — falls back to a solo org", async () => {
        const inviter = await seedMembership(pool);
        const { token } = await createOrganizationInvite(
          pool,
          inviter.organizationId,
          inviter.userId,
          {
            email: `intended-deferred-${randomUUID()}@example.test`,
            role: "member",
          },
        );

        const wrongEmail = `wrong-deferred-${randomUUID()}@example.test`;
        const subject = `subject-${randomUUID()}`;
        const userId = await provisionPendingIdentity(pool, {
          identityProvider: "test",
          identityProviderSubject: subject,
          displayName: "Wrong Person",
          primaryEmail: wrongEmail,
        });

        await completeDeferredIdentityProvisioning(pool, {
          userId,
          inviteToken: token,
          displayName: "Wrong Person",
        });

        const membership = await resolveOrganizationForIdentity(
          pool,
          "test",
          subject,
        );

        expect(membership?.organizationId).not.toBe(inviter.organizationId);

        // The real invitee's own invite is still untouched.
        const preview = await validateInviteToken(pool, token);
        expect(preview).not.toBeNull();
      });
    });
  },
);
