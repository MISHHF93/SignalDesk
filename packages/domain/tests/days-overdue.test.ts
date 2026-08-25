import { describe, expect, it } from "vitest";

import { daysOverdue } from "../src/index";

describe("daysOverdue", () => {
  it("returns 0 exactly on the due date", () => {
    const dueAt = new Date("2026-08-01T00:00:00.000Z");

    expect(daysOverdue(dueAt, dueAt)).toBe(0);
  });

  it("floors a partial day rather than rounding up", () => {
    const dueAt = new Date("2026-08-01T00:00:00.000Z");
    const now = new Date("2026-08-03T23:59:59.999Z");

    expect(daysOverdue(dueAt, now)).toBe(2);
  });

  it("counts a full extra day once 24 hours have fully elapsed", () => {
    const dueAt = new Date("2026-08-01T00:00:00.000Z");
    const now = new Date("2026-08-04T00:00:00.000Z");

    expect(daysOverdue(dueAt, now)).toBe(3);
  });

  it("clamps a not-yet-due date to 0 rather than returning a negative count", () => {
    const dueAt = new Date("2026-08-10T00:00:00.000Z");
    const now = new Date("2026-08-01T00:00:00.000Z");

    expect(daysOverdue(dueAt, now)).toBe(0);
  });
});
