import { describe, expect, it } from "vitest";

import { parseCsv } from "./parse-csv";

describe("parseCsv", () => {
  it("parses a simple comma-separated file", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles a quoted field containing a comma", () => {
    expect(parseCsv('name,note\nAcme,"Northstar, Inc."')).toEqual([
      ["name", "note"],
      ["Acme", "Northstar, Inc."],
    ]);
  });

  it("handles a quoted field containing an embedded newline", () => {
    expect(parseCsv('name,note\nAcme,"line one\nline two"')).toEqual([
      ["name", "note"],
      ["Acme", "line one\nline two"],
    ]);
  });

  it("handles an escaped double-quote inside a quoted field", () => {
    expect(parseCsv('name\n"Say ""hi"""')).toEqual([["name"], ['Say "hi"']]);
  });

  it("drops a trailing blank line rather than fabricating an empty row", () => {
    expect(parseCsv("a,b\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns [] for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("preserves an intentional empty field", () => {
    expect(parseCsv("a,b,c\n1,,3")).toEqual([
      ["a", "b", "c"],
      ["1", "", "3"],
    ]);
  });
});
