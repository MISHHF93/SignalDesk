import { describe, expect, it, vi } from "vitest";

import { createConsoleErrorReporter } from "./error-reporter";

describe("createConsoleErrorReporter", () => {
  it("logs a structured record with the safe identifiers and the error's own name/message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reporter = createConsoleErrorReporter();

    reporter.captureException(new Error("boom"), {
      organizationId: "org-1",
      connectorSlug: "hubspot",
      operation: "sync.failed",
      correlationId: "corr-1",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(logged).toMatchObject({
      level: "error",
      organizationId: "org-1",
      connectorSlug: "hubspot",
      operation: "sync.failed",
      correlationId: "corr-1",
      error: { name: "Error", message: "boom" },
    });

    spy.mockRestore();
  });

  it("handles a non-Error thrown value without crashing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reporter = createConsoleErrorReporter();

    reporter.captureException("a plain string throw", {
      operation: "some.operation",
    });

    const logged = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(logged.error).toEqual({
      name: "UnknownError",
      message: "a plain string throw",
    });

    spy.mockRestore();
  });

  it("never includes any field beyond the declared safe-identifier context", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reporter = createConsoleErrorReporter();

    reporter.captureException(new Error("boom"), { operation: "op" });

    const logged = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(Object.keys(logged).sort()).toEqual(
      ["error", "level", "operation"].sort(),
    );

    spy.mockRestore();
  });
});
