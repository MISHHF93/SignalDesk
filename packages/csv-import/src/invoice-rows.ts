import { createHash } from "node:crypto";

import { z } from "zod";

import { parseCsv } from "./parse-csv";

/**
 * A fixed, documented header format — deliberately not a general mapping
 * wizard (Prompt 28, docs/product-vision-backlog.md, ADR 0038's own
 * "before a general mapping wizard" scoping). A real escape hatch for a
 * business with invoice data in a spreadsheet and no connector, without
 * building drag-and-drop field mapping this app has exactly one real
 * consumer for today.
 */
export const INVOICE_CSV_REQUIRED_HEADERS = [
  "customer_name",
  "amount_cents",
  "currency",
  "due_at",
  "status",
] as const;

/** Recognized, but never required — most spreadsheets a business already
 * has won't include it, so this can't be a hard requirement (see
 * `contentHashFor`'s own doc comment for why it matters when it *is*
 * present). */
const INVOICE_NUMBER_HEADER = "invoice_number";

export interface ParsedInvoiceCsvRow {
  readonly rowNumber: number;
  readonly customerName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly dueAt: Date;
  readonly status: "open" | "paid" | "void";
  /** `null` when the file has no `invoice_number` column, or this row's
   * cell in it is blank — an honest "not provided," never a fabricated
   * placeholder. */
  readonly invoiceNumber: string | null;
  /** sha256 of the row's own normalized field values — the real
   * idempotency basis: re-uploading the identical row twice (same file
   * re-imported, or the same row appearing twice in one file) produces
   * the same `contentHash`, and the database's own
   * `source_records_org_idempotency_unique` constraint (reused unchanged
   * for CSV import) is what actually prevents the duplicate, the same
   * mechanism every real connector ingest already relies on. */
  readonly contentHash: string;
}

export interface InvoiceCsvRowError {
  readonly rowNumber: number;
  readonly message: string;
}

export type ParseInvoiceCsvResult =
  | { readonly ok: false; readonly headerError: string }
  | {
      readonly ok: true;
      readonly validRows: readonly ParsedInvoiceCsvRow[];
      readonly errors: readonly InvoiceCsvRowError[];
    };

const dateInputSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "must be a real date (e.g. 2026-08-20 or an ISO datetime)",
  });

const invoiceCsvRowSchema = z.strictObject({
  customerName: z.string().trim().min(1).max(500),
  amountCents: z.coerce.number().int().nonnegative().finite(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/),
  dueAt: dateInputSchema,
  status: z.enum(["open", "paid", "void"]),
  invoiceNumber: z.string().trim().min(1).max(200).optional(),
});

/**
 * Real gap found by review: without `invoiceNumber` in the hash, two
 * genuinely distinct invoices to the same customer, for the same amount,
 * currency, due date, and status (not a rare case — recurring/retainer
 * invoices, or two identical line items) hash identically. The second
 * would then silently fail `source_records`' own idempotency check and
 * be dropped as a "duplicate" — a real invoice lost with no error
 * surfaced anywhere. Folding in `invoiceNumber` when the file provides
 * one (the real, business-meaningful identifier an invoice actually has)
 * closes that for anyone using it. When a file has no `invoice_number`
 * column at all, content is still the only signal available — an honest,
 * disclosed residual limitation (surfaced per-row by this package's
 * caller, `import-csv-invoices.ts`, rather than silently absorbed here),
 * not one this function can fabricate its way out of.
 */
function contentHashFor(row: {
  readonly customerName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly dueAt: Date;
  readonly status: string;
  readonly invoiceNumber: string | null;
}): string {
  return createHash("sha256")
    .update(
      `${row.customerName}|${row.amountCents}|${row.currency}|${row.dueAt.toISOString()}|${row.status}|${row.invoiceNumber ?? ""}`,
    )
    .digest("hex");
}

/**
 * Parses, validates, and content-hashes a CSV file of invoices against
 * the fixed `INVOICE_CSV_REQUIRED_HEADERS` format. Never throws on a bad
 * row — a malformed row is collected as an `InvoiceCsvRowError` (matching
 * every real connector sync's own "skip and report, don't abort the
 * whole run" behavior, e.g. `syncQuickBooksInvoices`) so one typo doesn't
 * discard an otherwise-good file. Only a missing/wrong header set is a
 * hard failure — there is nothing safe to parse rows against otherwise.
 */
export function parseInvoiceCsvText(text: string): ParseInvoiceCsvResult {
  const rows = parseCsv(text);

  if (rows.length === 0) {
    return { ok: false, headerError: "The file is empty." };
  }

  const [header, ...dataRows] = rows;
  const normalizedHeader = (header ?? []).map((cell) =>
    cell.trim().toLowerCase(),
  );
  const missingHeaders = INVOICE_CSV_REQUIRED_HEADERS.filter(
    (required) => !normalizedHeader.includes(required),
  );

  if (missingHeaders.length > 0) {
    return {
      ok: false,
      headerError: `Missing required column${missingHeaders.length === 1 ? "" : "s"}: ${missingHeaders.join(", ")}. Expected headers: ${INVOICE_CSV_REQUIRED_HEADERS.join(", ")}.`,
    };
  }

  const columnIndex = new Map(
    INVOICE_CSV_REQUIRED_HEADERS.map((required) => [
      required,
      normalizedHeader.indexOf(required),
    ]),
  );
  // Unlike the required headers above, -1 (not present at all) is a valid,
  // expected state for this one — most files won't have it.
  const invoiceNumberColumnIndex = normalizedHeader.indexOf(
    INVOICE_NUMBER_HEADER,
  );

  const validRows: ParsedInvoiceCsvRow[] = [];
  const errors: InvoiceCsvRowError[] = [];

  dataRows.forEach((dataRow, index) => {
    // Row 1 is the header, so the first data row is genuinely row 2 —
    // matching how a person would count lines in a spreadsheet editor.
    const rowNumber = index + 2;

    const rawInvoiceNumber =
      invoiceNumberColumnIndex >= 0
        ? (dataRow[invoiceNumberColumnIndex] ?? "").trim()
        : "";

    const rawValues = {
      customerName: dataRow[columnIndex.get("customer_name")!] ?? "",
      amountCents: dataRow[columnIndex.get("amount_cents")!] ?? "",
      currency: dataRow[columnIndex.get("currency")!] ?? "",
      dueAt: dataRow[columnIndex.get("due_at")!] ?? "",
      status: dataRow[columnIndex.get("status")!] ?? "",
      // Omitted, never an empty string, when there's no real value — an
      // empty string would fail invoiceCsvRowSchema's own min(1) and turn
      // "column absent" or "cell blank" into a spurious validation error.
      invoiceNumber: rawInvoiceNumber === "" ? undefined : rawInvoiceNumber,
    };

    const parsed = invoiceCsvRowSchema.safeParse(rawValues);

    if (!parsed.success) {
      errors.push({
        rowNumber,
        message: parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      });
      return;
    }

    const dueAt = new Date(parsed.data.dueAt);
    const invoiceNumber = parsed.data.invoiceNumber ?? null;
    const row = {
      customerName: parsed.data.customerName,
      amountCents: parsed.data.amountCents,
      currency: parsed.data.currency,
      dueAt,
      status: parsed.data.status,
      invoiceNumber,
    };

    validRows.push({
      rowNumber,
      ...row,
      contentHash: contentHashFor(row),
    });
  });

  return { ok: true, validRows, errors };
}
