# ADR 0007: Scaffold social sign-in (Google, Slack, LinkedIn, Facebook)

- Status: Accepted
- Date: 2026-08-18
- Revises: ADR 0005's "out of scope: OAuth/social login providers" note

## Context

ADR 0005 deliberately deferred OAuth/social login. The product owner subsequently asked for Google, Slack, LinkedIn, and Facebook sign-in. Each requires a real OAuth app registered directly with that provider (Google Cloud Console, Slack API apps, Meta for Developers, LinkedIn Developer Portal) and a Client ID/Secret entered into Supabase's Auth > Providers dashboard — neither of which this agent can create on the product owner's behalf. The product owner chose to scaffold the full code path for all four now, each honestly labeled as not-yet-connected until real credentials exist, rather than build one provider end-to-end or wait.

## Decision

Real plumbing exists for all four providers so that enabling one later requires zero further code changes:

- `signInWithOAuthAction` (`app/_actions/auth.ts`) calls `supabase.auth.signInWithOAuth()` with Supabase's exact current provider ids — `google`, `slack_oidc`, `linkedin_oidc`, `facebook` (Supabase migrated the old `slack`/`linkedin` ids to their OIDC variants; using the deprecated ids would silently fail once configured).
- `app/auth/callback/route.ts` completes the PKCE flow via `exchangeCodeForSession()`, following Supabase's documented Next.js callback pattern exactly.
- `app/_lib/oauth-providers.ts`'s `isOAuthProviderEnabled()` reads `NEXT_PUBLIC_ENABLED_OAUTH_PROVIDERS` (empty by default) to decide, per provider, whether the UI renders a real button or an honest "not yet connected" row — this flag does not configure Supabase itself; it is purely a UI gate so a provider only ever appears clickable once it can actually complete a sign-in.
- `_components/oauth-buttons.tsx` renders a disabled provider as a non-interactive `<span>` status row, never a `<button>` that looks clickable but errors — the same rule the codebase already applies to connector "Connect" controls.

To enable a provider for real: register its OAuth app with the provider, enter the Client ID/Secret in Supabase's dashboard, then add its id to `NEXT_PUBLIC_ENABLED_OAUTH_PROVIDERS`.

## Consequences

No provider is actually usable yet — this ships the scaffold, not working social sign-in. Email/password remains the only functional path until at least one provider's real credentials are registered. Brand marks for all four (Google, Slack, LinkedIn, Facebook) are sourced from Simple Icons (CC0 1.0), matching the pattern already used for the connector catalog's logos.
