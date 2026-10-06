---
name: reporting-artifacts
description: Typed ReportSpecification pipeline, canonical structured report models, and multi-format renderers.
---

# Reporting & Artifacts Pipeline

## The Pipeline
`USER REQUEST` → `AUTHORIZATION` → `REPORT SPECIFICATION` → `BUSINESS GRAPH QUERY` → `DETERMINISTIC METRIC LAYER` → `EVIDENCE RETRIEVAL` → `OPTIONAL AI ANALYSIS` → `STRUCTURED REPORT MODEL` → `VALIDATION` → `RENDERER` → `ARTIFACT` → `EXPORT / SHARE`

## Supported Export Formats
- Executive PDF, Word (.docx), Markdown (.md), HTML
- Plain Text (.txt), CSV, TSV, Excel (.xlsx), JSON, JSONL
- Presentation (.pptx)

## Artifact Provenance Metadata
Every generated business artifact preserves:
- Tenant ID, Creator ID, Generation Timestamp
- Data As-Of Timestamp
- Source References & Ground-Truth IDs
- Metric Definition Formulas
- Model & Version Identifier (when AI assisted)
- Tamper-evident checksum
