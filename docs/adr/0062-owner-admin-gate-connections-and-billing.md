# ADR 0062: Restrict connector and billing management to owner/admin

- Status: Accepted
- Date: 2026-08-24
- **Update (2026-08-24, same-day follow-up)**: this ADR's 35 gated files,
  plus the 2 pre-existing ones (`connect-ai-provider.ts`/
  `disconnect-ai-provider.ts`) that already had this check, now have real
  regression tests for it — see "Follow-up: regression tests for the
  gate itself" after Consequences.

## Context

Two real, disclosed gaps surfaced this session, both the same shape as
each other: `SIGNALDESK_SYSTEM_CERTIFICATION.md`'s adversarial pass had
already found "connector connect/disconnect actions carry no role gate at
all (any authenticated member can disconnect an integration)... worth a
deliberate ADR-level decision someday" — deliberately left open rather
than decided unilaterally. Investigating the same question for `/billing`
found an identical gap never previously checked: every billing Server
Action (cancel, resume, change plan, add/remove an add-on, retry a
payment, start checkout) derived the caller's `organizationId` correctly
from session but never checked `role` — any authenticated member could
cancel or change the workspace's real subscription.

Both are exactly the class of decision this repo's own process treats as
the user's to make, not an engineering correctness call — asked directly,
and confirmed: restrict both to `owner`/`admin`, matching the pattern
already used for team invites, AI-provider connections, and workspace
settings on `/profile`.

## Decision

**Every connector connect/disconnect Server Action** (14 connectors × 2 =
28 files, plus the pre-existing `connect-ai-provider.ts`/
`disconnect-ai-provider.ts`, which already had this exact check) now
returns `"Only an owner or admin can connect/manage this connection."`
for a `member`/`viewer` session, checked immediately after the existing
`if (!session)` guard, in the identical style already established by the
AI-provider actions — no new abstraction, matching this repo's own
precedent of an inline two-line check rather than a shared helper for
something this small.

**Every billing-mutating Server Action** (`cancel-subscription.ts`,
`resume-subscription.ts`, `change-plan.ts` — both `previewPlanChangeAction`
and `changePlanAction`, which share one internal `resolveTargetPrice`
helper, so one check covers both — `manage-addon.ts`'s `addAddonAction`/
`removeAddonAction`, `retry-subscription-payment.ts`,
`start-payment-method-setup.ts`, and `start-checkout.ts`) gets the same
check.

**UI matches, but is explicitly the secondary layer, not the real
boundary**: `connector-detail-content.tsx` and `billing/page.tsx` each
compute the identical `role === "owner" || role === "admin"` condition
and show an honest explanatory state (`"Only an owner or admin can
disconnect this integration."` / `"...manage this workspace's
subscription."`) instead of the interactive controls for a `member`/
`viewer` — but the real enforcement is the 30 Server Action checks above,
each independently re-deriving the caller's role from their own session,
never trusting the UI decision that produced the click. This mirrors the
exact pattern the certification's own adversarial pass already verified
holds everywhere else in this app ("hide the button, not just the door" —
the anti-pattern being UI-only gating, which this explicitly is not).

**Sync (`SyncButton`) is deliberately left ungated.** The confirmed intent
was specifically about connecting/disconnecting a live integration and
managing money — refreshing already-connected data is a lower-stakes,
non-destructive read action any member can still trigger.

## Explicitly out of scope

- **A shared `canManageConnections`/`hasManagementRole` helper.** Three
  now-real call sites (`/profile`'s pre-existing `canManageTeam`, this
  ADR's connector/billing checks) all compute the identical
  `role === "owner" || role === "admin"` condition inline. A shared
  helper would be a real, small, defensible extraction — not done here to
  keep this change a pure authorization fix, not a refactor bundled with
  it; a natural follow-up if a fourth real call site appears.
- **Gating the "start a brand-new subscription" pricing table** when an
  org has no subscription at all yet (`/billing`'s `!subscription`
  branch). `startCheckoutAction` itself is gated server-side (a member
  attempting it gets the same honest rejection), but the pricing table UI
  itself isn't hidden in that specific empty-state branch — a smaller,
  rarer edge case judged not worth the added branching risk in an
  already-large change.
- **A configurable, per-workspace role policy.** This is a fixed rule
  (owner/admin only), matching every other sensitive-action gate already
  in this app — not a settings toggle.

## Consequences

Closes both gaps the certification's adversarial pass and this session's
own follow-up investigation found. A `member`/`viewer` can still see
connection status and subscription details (informational, unchanged) but
can no longer disconnect a live business-system integration or alter the
workspace's real subscription — matching the access level already
enforced for invites, AI-provider keys, and workspace settings.

## Follow-up: regression tests for the gate itself (2026-08-24, same day)

`apps/web/app/_actions/` (75 files) had no test coverage at all before
this — not specific to this ADR, true of the whole directory. That meant
the access-control property this ADR establishes had nothing to catch a
future regression (an edit that accidentally removed or weakened a role
check would only surface if someone happened to notice in review).

Added one `.test.ts` per gated action file — all 35 from this ADR plus
the 2 pre-existing ones (`connect-ai-provider.ts`/
`disconnect-ai-provider.ts`) that already had the identical check before
this ADR, for consistency (same security property, same absence of
coverage). Each file gets two assertions, not one:

- **Deny path** (`member`/`viewer`): the action returns the exact stated
  error, verbatim, **and** the first real side-effecting call after where
  the role check sits (`issueOAuthState` for a connect action,
  a `get<X>IntegrationStatus` lookup for a disconnect action,
  `checkRateLimit`/`getOrganizationSubscription`/
  `deleteAIProviderConnection` for a billing/AI-provider action) is
  asserted to never have been called. The second half is the property
  that actually matters — a test only checking the returned string would
  pass even if the code ran the real disconnect anyway and merely
  reported the wrong error alongside it.
- **Allow path** (`owner`/`admin`): the same denial is asserted to
  **not** occur, and the checkpoint function above **is** called —
  proving the gate doesn't also block a legitimate session. This
  deliberately does not drive every action all the way to its real
  external effect (that would need bespoke, fragile mocking of each
  connector's own OAuth/DB call graph, 35 times over, for a property this
  ADR isn't the one responsible for verifying); it tolerates the action
  throwing further downstream from intentionally minimal mocking beyond
  that checkpoint.

Two files needed a different shape than the rest, found by reading the
actual source rather than assuming uniformity:
`change-plan.ts`'s `previewPlanChangeAction`/`changePlanAction` share one
internal `resolveTargetPrice` helper that performs the real role check —
both exported functions still get their own full test pair, since both
are independently callable entry points regardless of the shared
implementation; and `changePlanAction` specifically calls `checkRateLimit`
at its own top level _before_ delegating to `resolveTargetPrice`, so its
test gives that mock an explicit allowed result rather than leaving it
automocked to `undefined`, which would otherwise throw before the role
gate is ever reached.

Verified with `pnpm -r typecheck`, `pnpm lint`, `pnpm --filter web test`
(225 passed, up from 69 in `apps/web` before this), `pnpm format:check`,
and a real `next build` — all clean.
