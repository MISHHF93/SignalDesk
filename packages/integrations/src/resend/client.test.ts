import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UpstreamProviderError } from "../shared/upstream-error";
import { sendEmail, type SendEmailInput } from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const INPUT: SendEmailInput = {
  apiKey: "re_test_key",
  from: "SignalDesk <briefs@signaldesk.test>",
  to: "owner@example.test",
  subject: "Your Daily Brief",
  html: "<p>Real content</p>",
};

describe("sendEmail", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("posts the real payload with a bearer-token authorization header", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "msg_123" }));

    const result = await sendEmail(INPUT);

    expect(result).toEqual({ id: "msg_123" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          from: INPUT.from,
          to: [INPUT.to],
          subject: INPUT.subject,
          html: INPUT.html,
        }),
      }),
    );
  });

  it("throws a safe UpstreamProviderError on a non-ok, non-retryable status, never leaking the raw response body into the client-visible message", async () => {
    // 401 is not one of fetchWithRetry's retryable statuses (429/5xx), so
    // this rejects immediately — no fake-timer advance needed, unlike the
    // retry test below.
    fetchMock.mockResolvedValue(
      jsonResponse(401, { message: "Invalid API key" }),
    );

    let thrown: unknown;

    try {
      await sendEmail(INPUT);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(UpstreamProviderError);
    const error = thrown as UpstreamProviderError;
    expect(error.message).not.toContain("401");
    expect(error.message).not.toContain("Invalid API key");
    expect(error.message).toContain("Email send failed");
    expect(error.rawDetail).toContain("401");
    expect(error.rawDetail).toContain("Invalid API key");
  });

  it("throws when the response is ok but carries no message id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await expect(sendEmail(INPUT)).rejects.toThrow(/no message id/);
  });

  it("retries on a 5xx before succeeding, reusing the shared retry policy", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(503, { message: "unavailable" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "msg_retry" }));

    const sendPromise = sendEmail(INPUT);
    await vi.runAllTimersAsync();
    const result = await sendPromise;

    expect(result).toEqual({ id: "msg_retry" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
