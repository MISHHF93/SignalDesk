import { beforeEach, describe, expect, it, vi } from "vitest";

// draftInvoiceReminderAction is a thin "use server" wrapper around one
// call to the shared, already-thoroughly-tested
// draftEntityContentAction(config) closure (see
// _lib/draft-entity-content-action.test.ts for the real gating/
// concurrency/rollback behavior every draft-*-action.ts file shares).
// This file's only real job is wiring: does it fetch the right entity
// type, and does it build a context object with the fields
// InvoiceReminderDraftContext actually needs? Mocking
// draftEntityContentAction itself and asserting on the config it's
// called with is more honest than re-driving the whole gate pipeline
// again here.
const mockedDraftEntityContentAction = vi.fn();
const mockedGetInvoiceById = vi.fn();

vi.mock("../_lib/draft-entity-content-action", () => ({
  draftEntityContentAction: mockedDraftEntityContentAction,
}));
vi.mock("@signaldesk/persistence", () => ({
  getInvoiceById: mockedGetInvoiceById,
}));

describe("draftInvoiceReminderAction wiring", () => {
  let capturedConfig: Record<string, unknown> | undefined;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    capturedConfig = undefined;
    mockedDraftEntityContentAction.mockImplementation((config) => {
      capturedConfig = config;
      return vi.fn();
    });
    await import("./draft-invoice-reminder-action");
  });

  it("configures the shared orchestrator for the invoice.overdue finding and invoice entity kind", () => {
    expect(capturedConfig).toMatchObject({
      findingType: "invoice.overdue",
      entityKind: "invoice",
      newFindingType: "invoice.reminder_drafted",
      actionType: "send_invoice_reminder",
      capability: "draft_invoice_reminder",
    });
  });

  it("fetches the invoice by id via getInvoiceById", async () => {
    mockedGetInvoiceById.mockResolvedValue({ id: "invoice-1" });

    const fetchEntity = capturedConfig?.fetchEntity as (
      db: unknown,
      organizationId: string,
      entityId: string,
    ) => Promise<unknown>;
    const entity = await fetchEntity(undefined, "org-1", "invoice-1");

    expect(mockedGetInvoiceById).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "invoice-1",
    );
    expect(entity).toEqual({ id: "invoice-1" });
  });

  it("builds a draft context carrying the invoice's real amount, currency, and days overdue — never a fabricated figure", () => {
    const buildDraftContext = capturedConfig?.buildDraftContext as (
      invoice: unknown,
      finding: unknown,
    ) => Record<string, unknown>;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const context = buildDraftContext(
      {
        customerName: "Acme Co.",
        amountCents: 50_000,
        currency: "USD",
        dueAt: oneWeekAgo,
        source: { system: "quickbooks" },
      },
      { id: "finding-1" },
    );

    expect(context).toMatchObject({
      capability: "draft_invoice_reminder",
      customerName: "Acme Co.",
      amountCents: 50_000,
      currency: "USD",
      daysOverdue: 7,
    });
  });

  it("regression: real gap found by review — refuses to draft a reminder for an invoice not sourced from QuickBooks, since only QuickBooks can actually send it", () => {
    // invoices is a shared table (QuickBooks and Xero both ingest into
    // it), but only the QuickBooks send path exists — a Xero-sourced
    // invoice used to be drafted the same as any other and would only
    // fail (or worse, target the wrong invoice) once approval tried to
    // actually send it through QuickBooks.
    const buildDraftContext = capturedConfig?.buildDraftContext as (
      invoice: unknown,
      finding: unknown,
    ) => Record<string, unknown>;

    expect(() =>
      buildDraftContext(
        {
          customerName: "Acme Co.",
          amountCents: 50_000,
          currency: "USD",
          dueAt: new Date(),
          source: { system: "xero" },
        },
        { id: "finding-1" },
      ),
    ).toThrow(/can currently only be sent through QuickBooks/);
  });
});
