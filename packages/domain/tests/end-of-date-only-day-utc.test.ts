import { describe, expect, it } from "vitest";

import { endOfDateOnlyDayUtc } from "../src/index";

/**
 * Real bug found by review: the previous implementation anchored to
 * plain end-of-day UTC (`{dateOnly}T23:59:59.999Z`), which is only safe
 * for timezones at or ahead of UTC. For any UTC-negative timezone — the
 * entire Western Hemisphere, including the US — local end-of-day on the
 * due date converts to a *later* UTC instant, so the overdue check fired
 * up to 12 hours before the real local deadline for this app's primary
 * market. These tests verify the fixed instant is safe (falls at or
 * after) every real-world UTC offset's true local end-of-day, not just
 * the ones ahead of UTC the previous version already handled correctly.
 */
describe("endOfDateOnlyDayUtc", () => {
  it("anchors 12 hours past plain end-of-day UTC", () => {
    expect(endOfDateOnlyDayUtc("2026-08-20")).toBe("2026-08-21T11:59:59.999Z");
  });

  it("regression: is not earlier than local end-of-day for a UTC-negative timezone (New York, UTC-4)", () => {
    // Local "2026-08-20T23:59:59.999" in New York (EDT, UTC-4) is
    // 2026-08-21T03:59:59.999Z — the real deadline this business cares
    // about. The old buggy implementation returned
    // "2026-08-20T23:59:59.999Z", four hours *before* that real deadline.
    const trueLocalDeadlineUtc = new Date("2026-08-21T03:59:59.999Z").getTime();

    const dueAt = new Date(endOfDateOnlyDayUtc("2026-08-20")).getTime();

    expect(dueAt).toBeGreaterThanOrEqual(trueLocalDeadlineUtc);
  });

  it("regression: is not earlier than local end-of-day at the most extreme real-world UTC-negative offset (UTC-12)", () => {
    // Local "2026-08-20T23:59:59.999" at UTC-12 is
    // 2026-08-21T11:59:59.999Z — the fixed instant must land at or after
    // this, the worst case across every real-world offset.
    const trueLocalDeadlineUtc = new Date("2026-08-21T11:59:59.999Z").getTime();

    const dueAt = new Date(endOfDateOnlyDayUtc("2026-08-20")).getTime();

    expect(dueAt).toBeGreaterThanOrEqual(trueLocalDeadlineUtc);
  });

  it("is not earlier than local end-of-day for a UTC-positive timezone (Tokyo, UTC+9)", () => {
    // Local "2026-08-20T23:59:59.999" in Tokyo (UTC+9) is
    // 2026-08-20T14:59:59.999Z — well before the fixed instant, matching
    // this function's own documented under-report-rather-than-over-report
    // direction for timezones ahead of UTC.
    const trueLocalDeadlineUtc = new Date("2026-08-20T14:59:59.999Z").getTime();

    const dueAt = new Date(endOfDateOnlyDayUtc("2026-08-20")).getTime();

    expect(dueAt).toBeGreaterThanOrEqual(trueLocalDeadlineUtc);
  });

  it("is not earlier than local end-of-day at the most extreme real-world UTC-positive offset (UTC+14)", () => {
    // Local "2026-08-20T23:59:59.999" at UTC+14 is
    // 2026-08-20T09:59:59.999Z.
    const trueLocalDeadlineUtc = new Date("2026-08-20T09:59:59.999Z").getTime();

    const dueAt = new Date(endOfDateOnlyDayUtc("2026-08-20")).getTime();

    expect(dueAt).toBeGreaterThanOrEqual(trueLocalDeadlineUtc);
  });
});
