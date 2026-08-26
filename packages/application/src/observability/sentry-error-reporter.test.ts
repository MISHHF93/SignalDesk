import { beforeEach, describe, expect, it, vi } from "vitest";

const initMock = vi.fn();
const captureExceptionMock = vi.fn();
const setTagMock = vi.fn();

vi.mock("@sentry/node", () => ({
  init: initMock,
  withScope: (callback: (scope: { setTag: typeof setTagMock }) => void) =>
    callback({ setTag: setTagMock }),
  captureException: captureExceptionMock,
}));

// Imported after vi.mock so the module under test resolves the mocked SDK.
const { createSentryErrorReporter } = await import("./sentry-error-reporter");

describe("createSentryErrorReporter", () => {
  beforeEach(() => {
    initMock.mockClear();
    captureExceptionMock.mockClear();
    setTagMock.mockClear();
  });

  it("initializes the Sentry SDK with the given dsn and environment", () => {
    createSentryErrorReporter({
      dsn: "https://example@sentry.io/1",
      environment: "production",
    });

    expect(initMock).toHaveBeenCalledWith({
      dsn: "https://example@sentry.io/1",
      environment: "production",
    });
  });

  it("reports an exception with every context field tagged", () => {
    const reporter = createSentryErrorReporter({
      dsn: "https://example@sentry.io/1",
    });
    const error = new Error("connector sync failed");

    reporter.captureException(error, {
      organizationId: "org-1",
      connectorSlug: "hubspot",
      operation: "sync_hubspot_deals",
      correlationId: "job-42",
    });

    expect(setTagMock).toHaveBeenCalledWith("operation", "sync_hubspot_deals");
    expect(setTagMock).toHaveBeenCalledWith("organizationId", "org-1");
    expect(setTagMock).toHaveBeenCalledWith("connectorSlug", "hubspot");
    expect(setTagMock).toHaveBeenCalledWith("correlationId", "job-42");
    expect(captureExceptionMock).toHaveBeenCalledWith(error);
  });

  it("only tags the fields present in a minimal context", () => {
    const reporter = createSentryErrorReporter({
      dsn: "https://example@sentry.io/1",
    });

    reporter.captureException(new Error("boom"), {
      operation: "run_agent_investigation",
    });

    expect(setTagMock).toHaveBeenCalledTimes(1);
    expect(setTagMock).toHaveBeenCalledWith(
      "operation",
      "run_agent_investigation",
    );
  });
});
