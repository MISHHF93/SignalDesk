import { describe, expect, it } from "vitest";

import {
  describeConnectorHealth,
  describeCoverageStatus,
  describeTimeToFirstSync,
} from "./visual-state";

/**
 * Real behavioral coverage for a file that had none: `describeConnectorHealth`
 * and `describeTimeToFirstSync` both do real branching/boundary logic
 * rendered directly on `/integrations` and the connector detail page, with
 * no React component-rendering test infra in this repo to catch a wrong
 * boundary indirectly (the same confirmed gap the Fourteenth pass already
 * documented) — every comparable pure-logic `_lib` helper already has its
 * own dedicated test file.
 */
describe("describeCoverageStatus", () => {
  it("reports 'Live' when fully connected", () => {
    expect(
      describeCoverageStatus({
        status: "connected",
        connectedConnectorNames: ["hubspot", "quickbooks"],
        totalConnectorNames: ["hubspot", "quickbooks"],
      }),
    ).toBe("Live");
  });

  it("reports the real connected-of-total count when only partially covered", () => {
    expect(
      describeCoverageStatus({
        status: "partial",
        connectedConnectorNames: ["hubspot"],
        totalConnectorNames: ["hubspot", "salesforce", "pipedrive"],
      }),
    ).toBe("1 of 3 live");
  });

  it("reports 'Not connected' when nothing is connected", () => {
    expect(
      describeCoverageStatus({
        status: "none",
        connectedConnectorNames: [],
        totalConnectorNames: ["hubspot"],
      }),
    ).toBe("Not connected");
  });
});

describe("describeConnectorHealth", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");

  it("reports 'Awaiting first sync' for an unknown status, ignoring lastSuccessfulSyncAt entirely", () => {
    expect(
      describeConnectorHealth(
        { status: "unknown", lastSuccessfulSyncAt: now },
        now,
      ),
    ).toBe("Awaiting first sync");
  });

  it("reports 'Live' with real relative freshness for a healthy connector", () => {
    const syncedAt = new Date(now.getTime() - 60 * 60 * 1000);
    expect(
      describeConnectorHealth(
        { status: "healthy", lastSuccessfulSyncAt: syncedAt },
        now,
      ),
    ).toBe("Live · last synced 1h ago");
  });

  it("reports 'never synced successfully' for a healthy connector with no successful sync yet", () => {
    expect(
      describeConnectorHealth(
        { status: "healthy", lastSuccessfulSyncAt: null },
        now,
      ),
    ).toBe("Live · never synced successfully");
  });

  it("reports 'Updates delayed' for a degraded connector", () => {
    const syncedAt = new Date(now.getTime() - 18 * 60 * 1000);
    expect(
      describeConnectorHealth(
        { status: "degraded", lastSuccessfulSyncAt: syncedAt },
        now,
      ),
    ).toBe("Updates delayed · last synced 18m ago");
  });

  it("reports 'Sync failing' for an error status", () => {
    const syncedAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    expect(
      describeConnectorHealth(
        { status: "error", lastSuccessfulSyncAt: syncedAt },
        now,
      ),
    ).toBe("Sync failing · last synced 2d ago");
  });
});

describe("describeTimeToFirstSync", () => {
  it("honestly reports still-waiting when no first sync has happened yet, rather than a placeholder countdown", () => {
    expect(describeTimeToFirstSync(null)).toBe(
      "Still waiting on your first successful sync — connect a tool above to get real data flowing.",
    );
  });

  it("reports minutes, singular, for exactly 1 minute", () => {
    expect(describeTimeToFirstSync(1)).toBe(
      "Your first real data synced 1 minute after you signed up.",
    );
  });

  it("reports minutes, plural, just under the 60-minute boundary", () => {
    expect(describeTimeToFirstSync(59)).toBe(
      "Your first real data synced 59 minutes after you signed up.",
    );
  });

  it("crosses into hours at exactly the 60-minute boundary", () => {
    expect(describeTimeToFirstSync(60)).toBe(
      "Your first real data synced 1 hour after you signed up.",
    );
  });

  it("reports hours, plural, well under the 24-hour boundary", () => {
    expect(describeTimeToFirstSync(90)).toBe(
      "Your first real data synced 2 hours after you signed up.",
    );
  });

  it("stays in hours just under the 24-hour boundary", () => {
    expect(describeTimeToFirstSync(23 * 60)).toBe(
      "Your first real data synced 23 hours after you signed up.",
    );
  });

  it("crosses into days at exactly the 24-hour boundary", () => {
    expect(describeTimeToFirstSync(24 * 60)).toBe(
      "Your first real data synced 1 day after you signed up.",
    );
  });

  it("reports days, plural, for a multi-day gap", () => {
    expect(describeTimeToFirstSync(3 * 24 * 60)).toBe(
      "Your first real data synced 3 days after you signed up.",
    );
  });
});
