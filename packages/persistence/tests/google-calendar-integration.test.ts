import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import { findOrCreateGmailIntegration } from "../src/gmail-integration";
import {
  disconnectGoogleCalendarIntegration,
  findOrCreateGoogleCalendarIntegration,
  getGoogleCalendarIntegrationStatus,
} from "../src/google-calendar-integration";
import { getTestPool, seedOrganization } from "./support";

// Mirrors gmail-integration.test.ts's coverage exactly.
describe.skipIf(!process.env.DATABASE_URL)(
  "google calendar integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new Google account, with a real label", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateGoogleCalendarIntegration(
        pool,
        org.id,
        "google-sub-91001",
        "alex@example.test",
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountLabel).toBe("alex@example.test");
    });

    it("reuses the same row for the same Google account rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateGoogleCalendarIntegration(
        pool,
        org.id,
        "google-sub-91002",
        "reuse@example.test",
      );
      const second = await findOrCreateGoogleCalendarIntegration(
        pool,
        org.id,
        "google-sub-91002",
        "reuse@example.test",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different Google account", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateGoogleCalendarIntegration(
        pool,
        org.id,
        "google-sub-91003",
        "one@example.test",
      );
      const second = await findOrCreateGoogleCalendarIntegration(
        pool,
        org.id,
        "google-sub-91004",
        "two@example.test",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateGoogleCalendarIntegration(
        pool,
        org.id,
        "google-sub-91006",
        "disconnect@example.test",
      );

      await disconnectGoogleCalendarIntegration(pool, org.id, integration.id);

      const status = await getGoogleCalendarIntegrationStatus(pool, org.id);
      expect(status?.status).toBe("disconnected");
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const original = await findOrCreateGoogleCalendarIntegration(
        pool,
        org.id,
        "google-sub-91007",
        "reconnect@example.test",
      );

      await disconnectGoogleCalendarIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateGoogleCalendarIntegration(
        pool,
        org.id,
        "google-sub-91007",
        "reconnect@example.test",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateGoogleCalendarIntegration(
        pool,
        orgB.id,
        "google-sub-91008",
        "foreign@example.test",
      );

      await expect(
        disconnectGoogleCalendarIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });

    it("keeps Gmail and Google Calendar as separate connections for the same Google account", async () => {
      const org = await seedOrganization(pool);

      const calendarConnection = await findOrCreateGoogleCalendarIntegration(
        pool,
        org.id,
        "google-sub-shared-91009",
        "shared@example.test",
      );

      const gmailConnection = await findOrCreateGmailIntegration(
        pool,
        org.id,
        "google-sub-shared-91009",
        "shared@example.test",
      );

      expect(calendarConnection.id).not.toBe(gmailConnection.id);
    });
  },
);
