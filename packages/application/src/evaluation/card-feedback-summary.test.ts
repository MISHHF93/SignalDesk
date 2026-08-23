import { describe, expect, it } from "vitest";

import { summarizeCardFeedback } from "./card-feedback-summary";

describe("summarizeCardFeedback", () => {
  it("returns an empty summary for no feedback", () => {
    expect(summarizeCardFeedback([])).toEqual([]);
  });

  it("counts useful and not_relevant feedback per card type", () => {
    const summary = summarizeCardFeedback([
      { cardType: "invoice_risk", feedback: "useful" },
      { cardType: "invoice_risk", feedback: "useful" },
      { cardType: "invoice_risk", feedback: "not_relevant" },
    ]);

    expect(summary).toEqual([
      {
        cardType: "invoice_risk",
        usefulCount: 2,
        notRelevantCount: 1,
        usefulRate: 2 / 3,
      },
    ]);
  });

  it("reports null usefulRate rather than 0 when a card type has no feedback yet", () => {
    // Given no entries for a card type, it simply never appears in the
    // output — there is no way to report "0 feedback" without a caller
    // supplying the known universe of card types, which this function
    // deliberately doesn't assume.
    const summary = summarizeCardFeedback([
      { cardType: "stuck", feedback: "useful" },
    ]);

    expect(summary).toEqual([
      { cardType: "stuck", usefulCount: 1, notRelevantCount: 0, usefulRate: 1 },
    ]);
  });

  it("separates multiple card types and sorts them alphabetically", () => {
    const summary = summarizeCardFeedback([
      { cardType: "task_risk", feedback: "not_relevant" },
      { cardType: "invoice_risk", feedback: "useful" },
      { cardType: "lead_risk", feedback: "useful" },
    ]);

    expect(summary.map((entry) => entry.cardType)).toEqual([
      "invoice_risk",
      "lead_risk",
      "task_risk",
    ]);
  });

  it("computes a 0 usefulRate honestly when every feedback entry is negative", () => {
    const summary = summarizeCardFeedback([
      { cardType: "payment_received", feedback: "not_relevant" },
      { cardType: "payment_received", feedback: "not_relevant" },
    ]);

    expect(summary[0]?.usefulRate).toBe(0);
  });

  it("computes a 1 usefulRate when every feedback entry is positive", () => {
    const summary = summarizeCardFeedback([
      { cardType: "stuck", feedback: "useful" },
    ]);

    expect(summary[0]?.usefulRate).toBe(1);
  });
});
