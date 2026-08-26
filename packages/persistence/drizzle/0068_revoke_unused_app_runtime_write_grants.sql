-- Real gap found by a systematic grant-vs-policy cross-check this pass,
-- run in response to the tasks_tenant_update finding (migration 0067):
-- five tables grant app_runtime UPDATE (users also grants INSERT) with
-- no matching RLS policy for any role -- the exact same shape that made
-- tasks_tenant_update's absence a silent no-op bug, just never yet
-- triggered because no code currently issues these statements
-- (confirmed: no `update leads/messages/source_records/support_tickets`
-- and no `insert into users` exists anywhere in packages/persistence).
--
-- These are not a second copy of the tasks bug -- real anonymize-on-
-- delete (ADR 0018) and identity provisioning already update/insert
-- these exact tables successfully today, but through
-- organization_data_steward / identity_provisioner, both real
-- SECURITY DEFINER roles with rolbypassrls = true (confirmed via
-- pg_roles), so they never depended on an app_runtime-facing RLS policy
-- in the first place. app_runtime (rolbypassrls = false) holding these
-- extra privileges was simply dead grant surface, not a second working
-- path -- revoking it doesn't remove any real capability, it closes the
-- exact latent footgun that already caused one real bug (tasks) and
-- keeps this from silently recurring the day a future feature adds an
-- UPDATE/INSERT here without also remembering the policy. If that day
-- comes, the correct fix is the same one migration 0067 modeled: add
-- the grant and the real tenant-scoped RLS policy together.
revoke update on public.leads from app_runtime;
revoke update on public.messages from app_runtime;
revoke update on public.source_records from app_runtime;
revoke update on public.support_tickets from app_runtime;
revoke insert, update on public.users from app_runtime;
