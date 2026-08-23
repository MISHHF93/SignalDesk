# ADR 0025: "Since You Left" brief — first real slice of the Executive Brief proposal

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 19 proposed an `Executive Brief`
system with several compositions (`Morning Brief`, `Since You Left`,
`End of Day`, a weekly review) derived from verified SignalDesk state,
never fabricated AI narrative. That entry's own reality check identified
this as the most directly buildable of the ten prompts in that batch: the
real Daily Brief engine (ADR 0016) already assembles a deterministic
document from real findings — "Since You Left" is a genuine, incremental
extension of it, not new architecture.

The literal proposal implies knowing when the user was last active. This
app has no per-user visit-history tracking anywhere (`BusinessSnapshot`'s
own `waitingOnMe`/`meaningfulChanges` fields are honestly typed but always
empty for exactly this reason, per README). Building a visit-log table
and instrumenting every page view just to unlock this one feature would
be exactly the kind of speculative infrastructure this session's own
discipline avoids.

## Decision

**Define "since you left" as "since your last Daily Brief," not "since
your last page view."** The organization's most recent `daily_brief`
artifact already persists a `sourceFindingIds` array — the exact finding
IDs that were open the last time a brief was generated. No new schema,
no new tracking: `getLatestArtifact(pool, organizationId, "daily_brief")`
already exists and returns everything needed.

**The diff is a real, deterministic set comparison, not a guess.** Every
`IntelligenceFinding.id` is already deterministic —
`{capabilityId}:{organizationId}:{entityId}` (see any capability in
`packages/intelligence/src/capabilities/`) — so the same real-world issue
(the same overdue invoice, the same stuck lead) keeps the same id across
two separate runs. `generateSinceYouLeftBrief`
(`packages/application/src/artifacts/daily-brief.ts`) computes:

- **New**: current findings whose id wasn't in the previous brief's
  `sourceFindingIds` — reported with full title/summary, since we have
  the live finding.
- **Resolved**: ids that were in the previous brief but aren't in the
  current finding set — reported as a count grouped by capability (e.g.
  "2 overdue invoices"), since only the id string survives from the prior
  run, not the full finding object. Parsing the capability prefix off a
  real, already-adopted id format is not a guess; it's the same
  information every capability already encodes into its own ids.

**Stored as the same `daily_brief` artifact type, not a new one.** Adding
`ArtifactType = "since_you_left"` would mean widening `artifactTypeSchema`
(Zod), the persistence-layer `ArtifactType`, and the `artifacts_type_allowed`
check constraint — a real migration for what is a different _composition_
of the same underlying document concept, not a different object.
`structuredData.mode: "since_you_left"` distinguishes it in history
without any schema change; `sourceFindingIds` on the new artifact becomes
the baseline for the _next_ "since you left" comparison, so successive
uses of the button always diff against the immediately preceding brief
(of either kind).

**No prior brief handling stays honest.** The very first time this runs
for an organization, there is nothing to diff against — the UI says so
explicitly ("No prior brief exists yet to compare against — showing
everything currently open") rather than silently showing an empty
"nothing changed" state that would misrepresent a first-run gap as a
quiet business.

**UI**: a second button ("Since you left") sits next to the existing
"Generate Daily Brief" control in `DailyBriefPanel`, sharing the same
artifact display below — matching this app's one-page product law rather
than adding a separate route or panel.

## Explicitly out of scope

`Morning Brief` and `End of Day` compositions (same underlying engine,
different framing — deferred, not blocked). Real per-user visit-history
tracking (would let a genuine "since you last visited the page" version
exist later, distinct from "since you last generated a brief"). Push/
email delivery. Role- or industry-adaptive composition. Any AI-generated
narrative — this stays deterministic assembly, matching ADR 0016's own
`generatedBy: "deterministic-assembly"` labeling exactly.

## Consequences

The Daily Brief engine now has two real compositions instead of one,
proving the artifact/`structuredData.mode` pattern as the right shape for
future brief variants without a schema change each time. This is a real,
if narrow, first slice of the Executive Brief proposal — the other
compositions and true visit-history tracking remain logged in
`docs/product-vision-backlog.md` as explicitly deferred, not silently
dropped.
