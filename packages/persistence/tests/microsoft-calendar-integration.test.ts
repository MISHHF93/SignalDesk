import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabasePool } from "../src/client";
import {
  disconnectMicrosoftCalendarIntegration,
  findOrCreateMicrosoftCalendarIntegration,
  getMicrosoftCalendarIntegrationStatus,
} from "../src/microsoft-calendar-integration";
import { findOrCreateMicrosoftOutlookIntegration } from "../src/microsoft-outlook-integration";
import { getTestPool, seedOrganization } from "./support";

// Mirrors microsoft-outlook-integration.test.ts's coverage exactly.
describe.skipIf(!process.env.DATABASE_URL)(
  "microsoft calendar integration (live database)",
  () => {
    let pool: DatabasePool;

    beforeAll(() => {
      pool = getTestPool();
    });

    afterAll(async () => {
      await pool.end();
    });

    it("creates a real, active integration row for a new Microsoft account, with a real label", async () => {
      const org = await seedOrganization(pool);

      const integration = await findOrCreateMicrosoftCalendarIntegration(
        pool,
        org.id,
        "ms-oid-93001",
        "alex@example.test",
      );

      expect(integration.status).toBe("active");
      expect(integration.externalAccountLabel).toBe("alex@example.test");
    });

    it("reuses the same row for the same Microsoft account rather than creating a duplicate", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateMicrosoftCalendarIntegration(
        pool,
        org.id,
        "ms-oid-93002",
        "reuse@example.test",
      );
      const second = await findOrCreateMicrosoftCalendarIntegration(
        pool,
        org.id,
        "ms-oid-93002",
        "reuse@example.test",
      );

      expect(second.id).toBe(first.id);
    });

    it("creates a separate row for a genuinely different Microsoft account", async () => {
      const org = await seedOrganization(pool);

      const first = await findOrCreateMicrosoftCalendarIntegration(
        pool,
        org.id,
        "ms-oid-93003",
        "one@example.test",
      );
      const second = await findOrCreateMicrosoftCalendarIntegration(
        pool,
        org.id,
        "ms-oid-93004",
        "two@example.test",
      );

      expect(second.id).not.toBe(first.id);
    });

    it("marks the integration disconnected", async () => {
      const org = await seedOrganization(pool);
      const integration = await findOrCreateMicrosoftCalendarIntegration(
        pool,
        org.id,
        "ms-oid-93006",
        "disconnect@example.test",
      );

      await disconnectMicrosoftCalendarIntegration(
        pool,
        org.id,
        integration.id,
      );

      const status = await getMicrosoftCalendarIntegrationStatus(pool, org.id);
      expect(status?.status).toBe("disconnected");
    });

    it("allows a real reconnect after disconnect, reusing the same row", async () => {
      const org = await seedOrganization(pool);
      const original = await findOrCreateMicrosoftCalendarIntegration(
        pool,
        org.id,
        "ms-oid-93007",
        "reconnect@example.test",
      );

      await disconnectMicrosoftCalendarIntegration(pool, org.id, original.id);
      const reconnected = await findOrCreateMicrosoftCalendarIntegration(
        pool,
        org.id,
        "ms-oid-93007",
        "reconnect@example.test",
      );

      expect(reconnected.id).toBe(original.id);
      expect(reconnected.status).toBe("active");
    });

    it("rejects disconnecting an integration outside the caller's tenant", async () => {
      const orgA = await seedOrganization(pool);
      const orgB = await seedOrganization(pool);
      const integrationB = await findOrCreateMicrosoftCalendarIntegration(
        pool,
        orgB.id,
        "ms-oid-93008",
        "foreign@example.test",
      );

      await expect(
        disconnectMicrosoftCalendarIntegration(pool, orgA.id, integrationB.id),
      ).rejects.toThrow(/not found in the current tenant context/i);
    });

    it("keeps Outlook and Microsoft Calendar as separate connections for the same Microsoft account", async () => {
      const org = await seedOrganization(pool);

      const calendarConnection = await findOrCreateMicrosoftCalendarIntegration(
        pool,
        org.id,
        "ms-oid-shared-93009",
        "shared@example.test",
      );

      const outlookConnection = await findOrCreateMicrosoftOutlookIntegration(
        pool,
        org.id,
        "ms-oid-shared-93009",
        "shared@example.test",
      );

      expect(calendarConnection.id).not.toBe(outlookConnection.id);
    });
  },
);
