import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UpstreamProviderError } from "../shared/upstream-error";
import {
  GmailInsufficientScopeError,
  sendGmailMessage,
  type SendGmailMessageInput,
} from "./client";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const INPUT: SendGmailMessageInput = {
  to: "jane@example.com",
  subject: "Re: Question about my order",
  body: "Thanks for reaching out — your order ships tomorrow.",
  threadId: "thread-123",
};

function decodeRawMessage(fetchMock: ReturnType<typeof vi.fn>): string {
  const call = fetchMock.mock.calls[0]!;
  const init = call[1] as RequestInit;
  const body = JSON.parse(init.body as string) as { raw: string };

  return Buffer.from(body.raw, "base64url").toString("utf-8");
}

describe("sendGmailMessage", () => {
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

  it("posts a real RFC 2822 message with the bearer token and the given thread id", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { id: "msg_1", threadId: "thread-123" }),
    );

    const result = await sendGmailMessage("access-token", INPUT);

    expect(result).toEqual({ id: "msg_1", threadId: "thread-123" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "Content-Type": "application/json",
        }),
      }),
    );

    const rawMessage = decodeRawMessage(fetchMock);

    expect(rawMessage).toContain(`To: ${INPUT.to}`);
    expect(rawMessage).toContain(`Subject: ${INPUT.subject}`);
    expect(rawMessage).toContain(INPUT.body);

    const call = fetchMock.mock.calls[0]!;
    const sentBody = JSON.parse((call[1] as RequestInit).body as string);

    expect(sentBody.threadId).toBe("thread-123");
  });

  it("omits threadId from the request when none is given", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { id: "msg_1", threadId: "thread-new" }),
    );

    await sendGmailMessage("access-token", {
      to: INPUT.to,
      subject: INPUT.subject,
      body: INPUT.body,
    });

    const call = fetchMock.mock.calls[0]!;
    const sentBody = JSON.parse((call[1] as RequestInit).body as string);

    expect(sentBody).not.toHaveProperty("threadId");
  });

  it("MIME-encodes a non-ASCII subject rather than sending raw UTF-8 bytes in a header", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { id: "msg_1", threadId: "thread-123" }),
    );

    await sendGmailMessage("access-token", {
      ...INPUT,
      subject: "Re: Café order — Bäcker",
    });

    const rawMessage = decodeRawMessage(fetchMock);

    expect(rawMessage).toMatch(/Subject: =\?UTF-8\?B\?/);
    expect(rawMessage).not.toContain("Café");
  });

  it("throws GmailInsufficientScopeError on a real insufficient-scope 403, not a generic upstream error", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, {
        error: {
          message: "Request had insufficient authentication scopes.",
          errors: [
            {
              message: "Insufficient Permission",
              reason: "insufficientPermissions",
            },
          ],
        },
      }),
    );

    await expect(sendGmailMessage("access-token", INPUT)).rejects.toThrow(
      GmailInsufficientScopeError,
    );
  });

  it("does not misclassify an unrelated 403 as an insufficient-scope error", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, {
        error: {
          message: "Daily sending quota exceeded.",
          errors: [{ message: "Quota exceeded", reason: "dailyLimitExceeded" }],
        },
      }),
    );

    let thrown: unknown;

    try {
      await sendGmailMessage("access-token", INPUT);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).not.toBeInstanceOf(GmailInsufficientScopeError);
    expect(thrown).toBeInstanceOf(UpstreamProviderError);
  });

  it("throws a safe UpstreamProviderError on a non-ok, non-retryable status, never leaking the raw response body", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: { message: "Invalid recipient address" } }),
    );

    let thrown: unknown;

    try {
      await sendGmailMessage("access-token", INPUT);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(UpstreamProviderError);
    const error = thrown as UpstreamProviderError;

    expect(error.message).not.toContain("Invalid recipient address");
    expect(error.rawDetail).toContain("Invalid recipient address");
  });

  it("throws when the response is ok but carries no message/thread id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await expect(sendGmailMessage("access-token", INPUT)).rejects.toThrow(
      /no message\/thread id/,
    );
  });

  it("retries on a 5xx before succeeding, reusing the shared retry policy", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(503, { error: { message: "unavailable" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { id: "msg_retry", threadId: "thread-123" }),
      );

    const sendPromise = sendGmailMessage("access-token", INPUT);
    await vi.runAllTimersAsync();
    const result = await sendPromise;

    expect(result).toEqual({ id: "msg_retry", threadId: "thread-123" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
