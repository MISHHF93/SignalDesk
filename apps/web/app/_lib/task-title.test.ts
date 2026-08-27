import { describe, expect, it } from "vitest";

import { buildTaskTitle } from "./task-title";

/**
 * Real behavioral coverage for a file that had none: `buildTaskTitle` does
 * real boundary arithmetic (a 200-character cap, minus the ellipsis length)
 * feeding `createInternalTaskInputSchema`'s own hard cap — every other pure,
 * boundary-bearing `_lib` helper already has a dedicated test file.
 */
describe("buildTaskTitle", () => {
  it("joins the prefix and card title unchanged when well under the cap", () => {
    expect(buildTaskTitle("Follow up", "Acme Corp renewal")).toBe(
      "Follow up: Acme Corp renewal",
    );
  });

  it("keeps a combined string exactly at the 200-character cap unchanged", () => {
    const prefix = "Follow up";
    const cardTitle = "x".repeat(200 - `${prefix}: `.length);
    const combined = `${prefix}: ${cardTitle}`;

    expect(combined.length).toBe(200);
    expect(buildTaskTitle(prefix, cardTitle)).toBe(combined);
  });

  it("truncates and appends an ellipsis for a combined string one character over the cap", () => {
    const prefix = "Follow up";
    const cardTitle = "x".repeat(200 - `${prefix}: `.length + 1);
    const combined = `${prefix}: ${cardTitle}`;

    expect(combined.length).toBe(201);

    const result = buildTaskTitle(prefix, cardTitle);

    expect(result.length).toBe(200);
    expect(result.endsWith("…")).toBe(true);
    expect(result).toBe(`${combined.slice(0, 199)}…`);
  });

  it("truncates a real, far-longer external-system title to a sensible task title rather than failing", () => {
    const longLeadName = "A".repeat(500);

    const result = buildTaskTitle("Draft a reply", longLeadName);

    expect(result.length).toBe(200);
    expect(result.startsWith("Draft a reply: ")).toBe(true);
    expect(result.endsWith("…")).toBe(true);
  });
});
