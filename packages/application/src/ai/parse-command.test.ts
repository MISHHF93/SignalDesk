import { describe, expect, it } from "vitest";

import { createDeterministicProvider } from "./deterministic-provider";
import { parseCommand } from "./parse-command";

describe("parseCommand", () => {
  it("returns a recognized, validated intent for a supported command", async () => {
    const provider = createDeterministicProvider();
    const result = await parseCommand(provider, "show only high items");

    expect(result).toEqual({
      recognized: true,
      intent: {
        type: "filter",
        filters: [{ field: "severity", operator: "eq", value: "high" }],
      },
    });
  });

  it("abstains (recognized: false) rather than guessing on unrecognized input", async () => {
    const provider = createDeterministicProvider();
    const result = await parseCommand(provider, "book a flight to Denver");

    expect(result).toEqual({
      recognized: false,
      rawText: "book a flight to Denver",
    });
  });

  it("abstains on blank input without calling the provider", async () => {
    const provider = createDeterministicProvider();
    const result = await parseCommand(provider, "   ");

    expect(result).toEqual({ recognized: false, rawText: "" });
  });

  it("abstains on an overlong command", async () => {
    const provider = createDeterministicProvider();
    const result = await parseCommand(provider, "a".repeat(301));

    expect(result.recognized).toBe(false);
  });
});
