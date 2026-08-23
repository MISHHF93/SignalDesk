# ADR 0030: `IMPLEMENTATION-READINESS.md` — first real slice of Production Hardening & Launch Gate

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 20 asked for a full
production-readiness audit producing a machine- and human-readable
Launch Matrix, plus a battery of end-to-end and security-focused test
scenarios, load tests, backup/restore validation, and incident runbooks.
That entry's own reality check correctly identified this as process, not
architecture — an audit worth running once enough of the rest of this
session's work is real enough to be worth auditing at production depth —
and pointed at an already-open question: `CLAUDE.md`'s own Process
section instructs maintaining an `IMPLEMENTATION-READINESS.md` with
exactly the `PRODUCTION_READY`/`FUNCTIONAL_NOT_HARDENED`/`PARTIAL`/
`MOCKED`/`BLOCKED`/`NOT_IMPLEMENTED` taxonomy this prompt asks for, but
the "Master product/engineering charter" backlog entry logged whether to
formalize a second tracking file (beyond README's own capability
snapshot) as "an open question, not yet decided."

## Decision

**Decided: yes, create it now.** Five real feature slices landed earlier
in this same session (ADR 0025–0029), each independently verified
end-to-end — this is exactly the point the backlog's own reality check
named as the right time to run this audit, not before.

**`IMPLEMENTATION-READINESS.md` is a companion to `README.md`, not a
replacement.** README's capability-snapshot table remains the
authoritative narrative source (per `CLAUDE.md` itself: "This README is
the authoritative top-level product and target-architecture
specification"). The new file is a terser, per-subsystem, status-tagged
table — scannable in one pass, which README's dense prose cells
deliberately are not — covering subsystems the proposal named (frontend,
mobile, API, auth, tenant isolation, database, connectors, webhook
security, secrets, Business Graph, Event Fabric, Signal Engine, AI
runtime, Agent Fabric, Action Gateway, observability, billing, backups,
rate limiting, privacy, audit logs, accessibility, documentation).

**Every classification cites real evidence — a test count, a live run,
or a specific ADR/file.** The proposal's own "require evidence for every
`PRODUCTION_READY` classification" rule is applied literally: before
writing the matrix, this ADR's author re-ran `pnpm typecheck`/`test`/
`lint`/`format:check`/`build` (all clean), the persistence package's full
276-test live-database suite against the real Supabase dev project, and
— for the first time this session — `pnpm test:production`, the existing
but previously-unrun production-mode smoke test and load test script
(`apps/web/scripts/production-readiness-check.mjs`): a real `next start`
server, all 10 smoke routes passing with expected status codes, two
clean load-test passes with zero errors. Only `authorization / tenant
isolation` and `documentation` are marked `PRODUCTION_READY`; every other
subsystem is honestly marked `FUNCTIONAL_NOT_HARDENED`, `PARTIAL`, or
`NOT_IMPLEMENTED` with a named, specific blocker.

## Explicitly out of scope

Live penetration testing (IDOR probing, webhook forgery, OAuth
state-parameter attacks) — named explicitly in the new file's "What this
audit deliberately did not do" section as requiring adversarial tooling
and a scoped, authorized testing window, not a code-reading pass. A
formal risk register or control-ownership map. Backup/restore drills. Any
change to security, tenant isolation, or data integrity — this audit only
reports state.

## Consequences

SignalDesk now has a real, evidence-backed answer to "what's actually
ready," in the exact taxonomy `CLAUDE.md` already committed to
maintaining. The file's own closing section ("How to keep this file
honest") makes explicit that a status without citable evidence is a
documentation bug — the same honesty discipline this repository has
applied to every other status claim.
