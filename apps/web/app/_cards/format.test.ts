import { describe, expect, it } from "vitest";

import { formatDueDate } from "./format";

const NOW = new Date("2026-08-23T12:00:00Z");

function minutesFromNow(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60 * 1_000);
}

describe("formatDueDate", () => {
  it("reads 'due now' within a minute either side of the deadline", () => {
    expect(formatDueDate(minutesFromNow(0), NOW)).toBe("due now");
    expect(formatDueDate(minutesFromNow(0.4), NOW)).toBe("due now");
    expect(formatDueDate(minutesFromNow(-0.4), NOW)).toBe("due now");
  });

  it("counts down for a future deadline instead of clamping to 'just now'", () => {
    expect(formatDueDate(minutesFromNow(30), NOW)).toBe("in 30m");
    expect(formatDueDate(minutesFromNow(120), NOW)).toBe("in 2h");
    expect(formatDueDate(minutesFromNow(60 * 24 * 3), NOW)).toBe("in 3d");
  });

  it("reads overdue, not 'ago', once the deadline has passed", () => {
    expect(formatDueDate(minutesFromNow(-30), NOW)).toBe("30m overdue");
    expect(formatDueDate(minutesFromNow(-120), NOW)).toBe("2h overdue");
    expect(formatDueDate(minutesFromNow(-60 * 24 * 3), NOW)).toBe("3d overdue");
  });
});
