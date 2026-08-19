# ADR 0009: Guest access via Supabase anonymous sign-in

- Status: Accepted
- Date: 2026-08-18

## Context

The product owner asked for a single button that gives immediate access to the real command center without creating an account first. The naive reading — remove the auth gate on `/` — would mean the page has no real organization to derive `getCurrentOrganization()` from, and would either break outright or force `/` back into showing something synthetic, undoing ADR 0005 and ADR 0006. Real per-tenant isolation (RLS, `withTenantContext`) has no meaning without a real, if anonymous, identity.

## Decision

Use Supabase Auth's built-in anonymous sign-in (`supabase.auth.signInAnonymously()`) rather than weakening or bypassing the auth gate. An anonymous sign-in is a real `auth.users` row with a real JWT (`is_anonymous: true` claim) — it goes through the exact same `on_auth_user_created` trigger and `provision_identity_and_organization()` path as a real signup (ADR 0005), so a guest gets a real, isolated, RLS-scoped organization exactly like any other user. Nothing about the authentication or authorization model changes; this adds one more way to obtain a session, not an exception to needing one.

`handle_new_auth_user()` (0013) now falls back to `'Guest'` for `display_name` when there is no email and no `full_name` in user metadata — both are true for an anonymous sign-in, and the column is `NOT NULL`, so every anonymous sign-in would otherwise fail at the trigger.

The session DAL (`getCurrentOrganization()`) and `CurrentSession` type now treat `email` as optional and expose `isAnonymous`, since an anonymous JWT has no email claim at all. The UI shows "Guest" instead of an email address for these sessions.

## Consequences

Anonymous sign-ins must be enabled in the Supabase dashboard (Authentication → Sign In / Providers → Anonymous Sign-Ins) before the guest button works — no tool available to this agent can toggle that setting; it is a manual step for the project owner, the same category of requirement as the OAuth credentials in ADR 0007. Supabase's own guidance recommends CAPTCHA on this endpoint to prevent abuse (a 30-requests-per-hour-per-IP limit applies by default) — not yet configured, and worth doing before this is exposed beyond low-traffic testing. A guest's data lives in a real organization tied to a real (anonymous) user; nothing distinguishes a guest's data from a permanent user's at the database layer, by design — only the UI and the `is_anonymous` JWT claim do.
