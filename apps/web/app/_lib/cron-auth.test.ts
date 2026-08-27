import { describe, expect, it } from "vitest";

import { verifyCronSecret } from "./cron-auth";

const CRON_SECRET = "test-cron-secret";

describe("verifyCronSecret", () => {
  it("accepts a matching bearer header", () => {
    expect(verifyCronSecret(`Bearer ${CRON_SECRET}`, CRON_SECRET)).toBe(true);
  });

  it("rejects a wrong secret rather than throwing", () => {
    expect(verifyCronSecret("Bearer wrong-secret", CRON_SECRET)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyCronSecret(null, CRON_SECRET)).toBe(false);
  });

  it("rejects when CRON_SECRET itself is unset — never treats undefined as a match", () => {
    expect(verifyCronSecret(`Bearer ${CRON_SECRET}`, undefined)).toBe(false);
  });

  it("rejects a header of the wrong length rather than throwing", () => {
    expect(verifyCronSecret("Bearer short", CRON_SECRET)).toBe(false);
  });

  it("rejects an empty header rather than throwing", () => {
    expect(verifyCronSecret("", CRON_SECRET)).toBe(false);
  });

  it("rejects a header missing the Bearer prefix", () => {
    expect(verifyCronSecret(CRON_SECRET, CRON_SECRET)).toBe(false);
  });
});
