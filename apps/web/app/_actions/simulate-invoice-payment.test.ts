import type * as ApplicationModule from "@signaldesk/application";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("@signaldesk/persistence");
// A partial mock, not a wholesale one — see run-agent-investigation.test.ts's
// own comment on why.
vi.mock("@signaldesk/application", async (importOriginal) => {
  const actual = await importOriginal<typeof ApplicationModule>();
  return { ...actual, simulateInvoicePaymentScenario: vi.fn() };
});

import { simulateInvoicePaymentScenario } from "@signaldesk/application";
import { listOverdueInvoices } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { simulateInvoicePaymentAction } from "./simulate-invoice-payment";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedListOverdueInvoices = vi.mocked(listOverdueInvoices);
const mockedSimulateInvoicePaymentScenario = vi.mocked(
  simulateInvoicePaymentScenario,
);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "member",
  email: "member@example.com",
  isAnonymous: false,
};

const OVERDUE_INVOICES = [
  { id: "invoice-1", amountCents: 10_000 },
  { id: "invoice-2", amountCents: 5_000 },
] as unknown as Awaited<ReturnType<typeof listOverdueInvoices>>;

/**
 * A pure, read-only comparison — no write path exists here at all, so
 * "never mutate production state" holds by construction, not just by
 * convention (see the source file's own doc comment). Re-fetches real
 * current overdue invoices rather than trusting a client-supplied list,
 * so a stale/removed invoiceId is refused honestly.
 */
describe("simulateInvoicePaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListOverdueInvoices.mockResolvedValue(OVERDUE_INVOICES);
  });

  it("returns early with no session", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await simulateInvoicePaymentAction("invoice-1");

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedListOverdueInvoices).not.toHaveBeenCalled();
  });

  it("refuses honestly when the invoice is no longer overdue or no longer exists", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);

    const result = await simulateInvoicePaymentAction("invoice-999");

    expect(result).toEqual({
      ok: false,
      error: "This invoice is no longer overdue, or no longer exists.",
    });
    expect(mockedSimulateInvoicePaymentScenario).not.toHaveBeenCalled();
  });

  it("runs the real, pure simulation against the organization's actual current overdue invoices", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    const scenarioResult = { projectedCashCents: 10_000 };
    mockedSimulateInvoicePaymentScenario.mockReturnValue(
      scenarioResult as unknown as ReturnType<
        typeof simulateInvoicePaymentScenario
      >,
    );

    const result = await simulateInvoicePaymentAction("invoice-1");

    expect(result).toEqual({ ok: true, result: scenarioResult });
    expect(mockedSimulateInvoicePaymentScenario).toHaveBeenCalledWith(
      OVERDUE_INVOICES,
      ["invoice-1"],
    );
  });

  it("returns a description of the failure when the invoice lookup itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedListOverdueInvoices.mockRejectedValue(new Error("db unavailable"));

    const result = await simulateInvoicePaymentAction("invoice-1");

    expect(result).toEqual({ ok: false, error: "db unavailable" });
  });
});
