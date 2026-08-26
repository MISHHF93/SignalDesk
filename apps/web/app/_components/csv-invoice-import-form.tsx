"use client";

import { INVOICE_CSV_REQUIRED_HEADERS } from "@signaldesk/csv-import";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import type {
  ImportCsvInvoicesAction,
  ImportCsvInvoicesActionResult,
  PreviewCsvInvoiceImportAction,
  PreviewCsvInvoiceImportActionResult,
} from "../_lib/actions";
import { Button } from "./button";

type Stage = "idle" | "previewing" | "previewed" | "importing" | "imported";

/**
 * Universal Data Intake's one real UI (Prompt 28,
 * docs/product-vision-backlog.md, ADR 0038): upload → preview (dry-run,
 * writes nothing) → confirm → real import, against the fixed documented
 * header format `INVOICE_CSV_REQUIRED_HEADERS` — deliberately not a
 * drag-and-drop mapping wizard, per this slice's own scoping.
 */
export function CsvInvoiceImportForm({
  previewAction,
  importAction,
}: {
  readonly previewAction: PreviewCsvInvoiceImportAction;
  readonly importAction: ImportCsvInvoicesAction;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [previewResult, setPreviewResult] =
    useState<PreviewCsvInvoiceImportActionResult | null>(null);
  const [importResult, setImportResult] =
    useState<ImportCsvInvoicesActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    setCsvText(text);
    setFileName(file.name);
    setStage("idle");
    setPreviewResult(null);
    setImportResult(null);
  }

  function handlePreview() {
    if (!csvText) {
      return;
    }

    setStage("previewing");

    startTransition(async () => {
      const result = await previewAction(csvText);
      setPreviewResult(result);
      setStage("previewed");
    });
  }

  function handleImport() {
    if (!csvText) {
      return;
    }

    setStage("importing");

    startTransition(async () => {
      const result = await importAction(csvText);
      setImportResult(result);
      setStage("imported");

      if (result.ok) {
        router.refresh();
      }
    });
  }

  function handleReset() {
    setCsvText(null);
    setFileName(null);
    setStage("idle");
    setPreviewResult(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="csvImportForm">
      <label htmlFor="csv-invoice-file">Invoice CSV file</label>
      <p className="csvImportHeaderHint" id="csv-invoice-file-hint">
        Required columns: <code>{INVOICE_CSV_REQUIRED_HEADERS.join(", ")}</code>
        . An optional <code>invoice_number</code> column is also recognized —
        include it if you have it, so two otherwise-identical invoices
        aren&rsquo;t mistaken for duplicates.
      </p>

      <input
        ref={fileInputRef}
        id="csv-invoice-file"
        type="file"
        accept=".csv,text/csv"
        aria-describedby="csv-invoice-file-hint"
        onChange={handleFileChange}
      />

      {fileName ? <p className="csvImportFileName">{fileName}</p> : null}

      {/* Real gap found by review: the Preview/Import buttons below only
          render while `stage === "idle"`/`"previewed"` respectively — the
          instant each one's handler flips `stage` to `"previewing"`/
          `"importing"`, that same condition goes false and the whole
          block (button included) disappears until the result lands,
          leaving the panel looking frozen with zero pending feedback for
          the entire request. This status line is not gated on `stage`
          the same way, so it stays visible for exactly the window the
          buttons are hidden. */}
      {stage === "previewing" || stage === "importing" ? (
        <p className="cardActionStatus cardActionStatus-pending" role="status">
          {stage === "previewing" ? "Previewing…" : "Importing…"}
        </p>
      ) : null}

      {csvText && stage === "idle" ? (
        <Button
          variant="secondary"
          onClick={handlePreview}
          disabled={isPending}
        >
          Preview
        </Button>
      ) : null}

      {previewResult && stage === "previewed" ? (
        previewResult.ok ? (
          <div className="csvImportPreview">
            <p>
              {previewResult.validRowCount} row
              {previewResult.validRowCount === 1 ? "" : "s"} ready to import.
              {previewResult.errors.length > 0
                ? ` ${previewResult.errors.length} row${previewResult.errors.length === 1 ? "" : "s"} will be skipped.`
                : ""}
            </p>
            {previewResult.errors.length > 0 ? (
              <ul className="csvImportErrorList">
                {previewResult.errors.map((error) => (
                  <li key={error.rowNumber}>
                    Row {error.rowNumber}: {error.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {previewResult.validRowCount > 0 ? (
              // This button (and the block containing it) only ever
              // renders while `stage === "previewed"` — the instant
              // `handleImport` flips `stage` to `"importing"`, this whole
              // block stops rendering, so an `isPending`-driven label
              // here would be dead code. The status line above (rendered
              // exactly during `stage === "importing"`) is what actually
              // shows pending feedback for this action.
              <Button onClick={handleImport} disabled={isPending}>
                Import {previewResult.validRowCount} row
                {previewResult.validRowCount === 1 ? "" : "s"}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="csvImportResult">
            <p className="csvImportError" role="alert">
              {previewResult.error}
            </p>
            <Button variant="ghost" onClick={handleReset}>
              Try again
            </Button>
          </div>
        )
      ) : null}

      {importResult && stage === "imported" ? (
        importResult.ok ? (
          <div className="csvImportResult">
            <p role="status">
              Imported {importResult.imported} invoice
              {importResult.imported === 1 ? "" : "s"}.
              {importResult.duplicates > 0
                ? ` ${importResult.duplicates} already imported (skipped).`
                : ""}
              {importResult.rowErrors.length > 0
                ? ` ${importResult.rowErrors.length} row${importResult.rowErrors.length === 1 ? "" : "s"} skipped for validation errors.`
                : ""}
            </p>
            {importResult.duplicateRows.length > 0 ? (
              <ul className="csvImportErrorList">
                {importResult.duplicateRows.map((rowNumber) => (
                  <li key={rowNumber}>Row {rowNumber}: already imported.</li>
                ))}
              </ul>
            ) : null}
            {importResult.rowErrors.length > 0 ? (
              <ul className="csvImportErrorList">
                {importResult.rowErrors.map((error) => (
                  <li key={error.rowNumber}>
                    Row {error.rowNumber}: {error.message}
                  </li>
                ))}
              </ul>
            ) : null}
            <Button variant="ghost" onClick={handleReset}>
              Import another file
            </Button>
          </div>
        ) : (
          <div className="csvImportResult">
            <p className="csvImportError" role="alert">
              {importResult.error}
            </p>
            <Button variant="ghost" onClick={handleReset}>
              Try again
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}
