# ADR 0001: Core technology stack

- Status: Accepted
- Date: 2026-08-18

## Context

The product is an interactive, integration-heavy, multi-tenant SaaS system. It needs shared contracts across the one-page UI, server entry points, background work, connectors, policy evaluation, AI orchestration, and controlled actions. The repository had no implementation constraints when this decision was made.

## Decision

- Use TypeScript as the primary product language.
- Use React and Next.js for the web command center.
- Begin as a modular monolith with a Next.js web composition root and a TypeScript worker composition root when the first real connector is added.
- Use PostgreSQL as the primary relational datastore.
- Use pnpm workspaces without adding a separate monorepo build orchestrator until scale justifies it.
- Pin Node.js 24.16.0, pnpm 9.15.0, and TypeScript 6.0.3 for the initial scaffold.

TypeScript 7 was not selected because the current TypeScript-ESLint release declares support only for TypeScript versions below 6.1. The choice can be revisited after the linting toolchain supports it.

## Consequences

Frontend and server contracts can share a toolchain and compiler configuration. Package boundaries remain architectural—not security—boundaries. Exact identity, queue, cloud, and AI providers remain undecided.
