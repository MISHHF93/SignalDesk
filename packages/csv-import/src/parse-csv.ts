/**
 * A minimal, dependency-free RFC4180-style CSV parser (Prompt 28,
 * docs/product-vision-backlog.md, ADR 0038) — handles the common real
 * cases (quoted fields, escaped `""` inside a quoted field, commas and
 * newlines inside quoted fields, CRLF/LF line endings, a trailing blank
 * line) but does not claim full spec coverage. Deliberately hand-rolled
 * rather than a new npm dependency for a single, small, fully-tested
 * function.
 */
export function parseCsv(text: string): readonly (readonly string[])[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  function endField() {
    row.push(field);
    field = "";
  }

  function endRow() {
    endField();
    rows.push(row);
    row = [];
  }

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === ",") {
      endField();
      i += 1;
      continue;
    }

    if (char === "\r") {
      i += 1;
      continue;
    }

    if (char === "\n") {
      endRow();
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  // A trailing field/row only counts if the input didn't already end on a
  // newline (endRow already flushed that case) — otherwise a file with a
  // final blank line would produce one spurious empty row.
  if (field.length > 0 || row.length > 0) {
    endRow();
  }

  // Every genuinely blank line (no fields at all, not even one empty
  // string) is dropped — a CSV editor's trailing blank lines shouldn't
  // become fabricated empty data rows.
  return rows.filter(
    (parsedRow) => !(parsedRow.length === 1 && parsedRow[0] === ""),
  );
}
