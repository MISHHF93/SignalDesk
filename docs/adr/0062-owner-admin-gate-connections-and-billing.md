# ADR 0062: Restrict connector and billing management to owner/admin

- Status: Accepted
- Date: 2026-08-24

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
