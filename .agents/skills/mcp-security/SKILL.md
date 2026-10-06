---
name: mcp-security
description: Security guidelines for MCP servers, capability scoping, credential isolation, and prompt injection defense.
---

# MCP Security & Isolation in SignalDesk

## 1. Zero Credential Exposure
- Never expose OAuth access tokens, refresh tokens, API secrets, or database credentials through MCP.
- External clients receive capabilities, not credentials.
- All downstream calls to Stripe, Salesforce, or QuickBooks are executed server-side by SignalDesk's authenticated connectors.

## 2. Parameter Validation & Schemas
- Every tool payload must be validated strictly against JSON Schema (2020-12) definitions before execution.
- Reject unvalidated properties or polymorphic overrides.

## 3. Sandboxing External MCP Servers
- Treat third-party MCP servers as potentially hostile.
- Do not automatically grant write or network authority to newly connected community MCP servers.
- Maintain human-in-the-loop gates for any action that mutates financial, customer, or operational data.
