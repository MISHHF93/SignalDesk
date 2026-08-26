import { describe, expect, it } from "vitest";

import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("passes through a real relative path", () => {
    expect(safeNextPath("/integrations")).toBe("/integrations");
  });

  it("passes through a relative path with a query string", () => {
    expect(safeNextPath("/billing?plan=business")).toBe(
      "/billing?plan=business",
    );
  });

  it("defaults non-string input to /", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(42)).toBe("/");
  });

  it("defaults a value not starting with / to /", () => {
    expect(safeNextPath("integrations")).toBe("/");
    expect(safeNextPath("https://evil.example/")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("rejects a protocol-relative URL", () => {
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("///evil.example")).toBe("/");
  });

  it('rejects the backslash bypass a bare startsWith("/") check misses', () => {
    // Browsers normalize a leading backslash to a forward slash when
    // resolving a relative reference, so these would otherwise resolve
    // identically to "//evil.example" — a real, previously-found bug.
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/\\/evil.example")).toBe("/");
    expect(safeNextPath("/foo\\evil.example")).toBe("/");
  });
});
