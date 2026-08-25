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

  it("drops an Error subclass's own extra properties, not just an unused 'context' argument", () => {
    // Mirrors the real shape of packages/integrations's UpstreamProviderError,
    // which deliberately carries a raw-upstream-response-body property
    // alongside its own safe `.message`. Node's `console.error(err)` prints
    // an Error's own enumerable properties after the stack trace by
    // default — confirmed live against this exact shape — so naively
    // logging the error object itself (as every call site this reporter
    // replaced used to do) would leak that raw body into infrastructure
    // logs. This test would fail if `captureException` ever started
    // spreading the error object instead of picking only `name`/`message`.
    class RichUpstreamError extends Error {
      readonly rawDetail: string;
      readonly status: number;

      constructor(safeMessage: string, rawDetail: string, status: number) {
        super(safeMessage);
        this.name = "RichUpstreamError";
        this.rawDetail = rawDetail;
        this.status = status;
      }
    }

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reporter = createConsoleErrorReporter();

    reporter.captureException(
      new RichUpstreamError(
        "QuickBooks invoice reminder failed. Please try again.",
        "502 <html>upstream error page containing real customer data</html>",
        502,
      ),
      { operation: "sync_quickbooks.invoice_validation" },
    );

    const logged = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(logged.error).toEqual({
      name: "RichUpstreamError",
      message: "QuickBooks invoice reminder failed. Please try again.",
    });
    expect(JSON.stringify(logged)).not.toContain("real customer data");

    spy.mockRestore();
  });
});
