import { describe, expect, it, vi } from "vitest";

import { createConsoleLogger } from "./logger";

describe("createConsoleLogger", () => {
  it("logs a structured record on console.log at info level", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createConsoleLogger();

    logger.log("info", "Sync completed", {
      organizationId: "org-1",
      connectorSlug: "hubspot",
      operation: "sync.completed",
      correlationId: "corr-1",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(logged).toEqual({
      level: "info",
      message: "Sync completed",
      organizationId: "org-1",
      connectorSlug: "hubspot",
      operation: "sync.completed",
      correlationId: "corr-1",
    });

    spy.mockRestore();
  });

  it("logs on console.warn at warn level", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = createConsoleLogger();

    logger.log("warn", "Rate limit exceeded", { operation: "cron.sweep" });

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(logged).toMatchObject({
      level: "warn",
      message: "Rate limit exceeded",
    });

    spy.mockRestore();
  });

  it("logs on console.error at error level", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createConsoleLogger();

    logger.log("error", "Signature verification failed", {
      operation: "webhook.verify",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(logged).toMatchObject({
      level: "error",
      message: "Signature verification failed",
    });

    spy.mockRestore();
  });

  it("omits an unset optional context field rather than including it as undefined", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createConsoleLogger();

    logger.log("info", "Minimal context", { operation: "op" });

    const logged = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(Object.keys(logged).sort()).toEqual(
      ["level", "message", "operation"].sort(),
    );

    spy.mockRestore();
  });
});
