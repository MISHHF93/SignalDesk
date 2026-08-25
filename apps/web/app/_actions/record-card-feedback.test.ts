import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("@signaldesk/persistence");

import { recordCardFeedback } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { recordCardFeedbackAction } from "./record-card-feedback";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedRecordCardFeedback = vi.mocked(recordCardFeedback);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "member",
  email: "member@example.com",
  isAnonymous: false,
};

describe("recordCardFeedbackAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early with no session and performs no write", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await recordCardFeedbackAction(
      "finding-1",
      "invoice_overdue",
      "useful",
    );

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedRecordCardFeedback).not.toHaveBeenCalled();
  });

  it("records feedback scoped to the session's own organization and the real finding/card ids passed in", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedRecordCardFeedback.mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof recordCardFeedback>>,
    );

    const result = await recordCardFeedbackAction(
      "finding-1",
      "invoice_overdue",
      "not_relevant",
    );

    expect(result).toEqual({ ok: true });
    expect(mockedRecordCardFeedback).toHaveBeenCalledWith(undefined, "org-1", {
      userId: "user-1",
      findingId: "finding-1",
      cardType: "invoice_overdue",
      feedback: "not_relevant",
    });
  });

  it("returns a description of the failure when the write itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedRecordCardFeedback.mockRejectedValue(new Error("db unavailable"));

    const result = await recordCardFeedbackAction(
      "finding-1",
      "invoice_overdue",
      "useful",
    );

    expect(result).toEqual({ ok: false, error: "db unavailable" });
  });
});
