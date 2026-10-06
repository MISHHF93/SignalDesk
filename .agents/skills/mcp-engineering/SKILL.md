---
name: mcp-engineering
description: Model Context Protocol (MCP) 2026 server and client architecture, JSON-RPC 2.0 transport, tool definitions, and registry guidelines for SignalDesk.
---

# MCP Engineering in SignalDesk

## Protocol Boundary Principles
- Separate MCP protocol details from internal domain logic:
  `MCP PROTOCOL → CONNECTOR / BUSINESS CAPABILITY CONTRACT → BUSINESS GRAPH / DOMAIN SERVICES → POLICY → APPROVAL → EXECUTION → VERIFICATION`.
- SignalDesk operates in dual mode:
  1. **MCP Server**: Exposes 24+ authorized business-semantic capabilities to external AI clients (Claude Desktop, Cursor, Gemini, custom agents).
  2. **MCP Client**: Discovers, inspects, wraps, and consumes external third-party or provider MCP servers under strict governance.

## Official 2026 Protocol Compliance
- Transport endpoints: `/api/mcp` (HTTP POST JSON-RPC 2.0) and `/api/mcp/sse` (Server-Sent Events streaming).
- Discovery: `/api/mcp/manifest` returning server metadata, capabilities (`tools`, `resources`, `prompts`), trust tier, and protocol version `2026-07-28`.
- Registry: `/api/mcp/registry` listing curated and verified MCP packages.

## Trust Tiers
- `OFFICIAL_PROVIDER_MCP`: Provider-maintained (Stripe, HubSpot, Salesforce, Google Workspace).
- `SIGNALDESK_VERIFIED_MCP`: Vetted, audited, and tested by SignalDesk with full capability mapping.
- `COMMUNITY_MCP`: Third-party open-source server requiring sandbox review.
- `PRIVATE_MCP`: Internal organization-specific MCP server.
- `UNVERIFIED_MCP`: Newly discovered, untrusted server isolated from writes.

## Capability Maturity Levels
- `READ_VERIFIED`: Safe read-only data extraction.
- `WRITE_VERIFIED`: Idempotent state writes with audit capture.
- `VERIFIED_ACTIONS`: Safe Action Gateway governed consequential actions with post-execution verification.
