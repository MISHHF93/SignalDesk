CREATE TABLE "organization_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invited_by_membership_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_invites_org_id_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "organization_invites_token_unique" UNIQUE("token"),
	CONSTRAINT "organization_invites_role_allowed" CHECK ("organization_invites"."role" in ('admin', 'member', 'viewer')),
	CONSTRAINT "organization_invites_status_allowed" CHECK ("organization_invites"."status" in ('pending', 'accepted', 'revoked', 'expired')),
	CONSTRAINT "organization_invites_email_not_blank" CHECK (length(btrim("organization_invites"."email")) > 0),
	CONSTRAINT "organization_invites_token_not_blank" CHECK (length(btrim("organization_invites"."token")) > 0),
	CONSTRAINT "organization_invites_acceptance_state_consistent" CHECK (("organization_invites"."status" = 'accepted' and "organization_invites"."accepted_at" is not null) or ("organization_invites"."status" != 'accepted' and "organization_invites"."accepted_at" is null))
);
--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_org_invited_by_fk" FOREIGN KEY ("organization_id","invited_by_membership_id") REFERENCES "public"."memberships"("organization_id","id") ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX "organization_invites_org_status_index" ON "organization_invites" USING btree ("organization_id","status");
--> statement-breakpoint

-- Real multi-member invites (Phase 3, implementation roadmap). Standard
-- tenant RLS for managing invites (owner/admin only in practice, enforced
-- at the Server Action layer — the same division of labor billing actions
-- already use, RLS for tenant isolation, application code for role
-- checks). This is NOT how a token gets validated or accepted, though —
-- see the two functions below for why.

alter table public.organization_invites enable row level security;
--> statement-breakpoint
alter table public.organization_invites force row level security;
--> statement-breakpoint

create policy organization_invites_tenant_select on public.organization_invites
  for select
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy organization_invites_tenant_insert on public.organization_invites
  for insert
  with check (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

create policy organization_invites_tenant_update on public.organization_invites
  for update
  using (
    organization_id = nullif((select current_setting('app.current_organization_id', true)), '')::uuid
  );
--> statement-breakpoint

revoke all on public.organization_invites from public, anon, authenticated;
--> statement-breakpoint

grant select, insert, update on public.organization_invites to app_runtime;
--> statement-breakpoint

-- Real, pre-authentication token validation — an unauthenticated visitor
-- clicking an invite link has no tenant context yet (same problem
-- `resolve_memberships_for_identity`, drizzle/0007, already solves for
-- resolving an existing identity's org). SECURITY DEFINER, owned by the
-- same narrow `identity_provisioner` role, read-only: this never mutates
-- anything — acceptance only ever happens inside
-- `provision_identity_and_organization` below, atomically with creating
-- the real membership, never as a separate step a client could call out
-- of order.
create or replace function public.validate_organization_invite_token(
  p_token text
)
returns table(
  organization_id uuid,
  organization_name text,
  email text,
  role text
)
security definer
set search_path = ''
stable
language sql
as $function$
  select oi.organization_id, o.display_name, oi.email, oi.role
  from public.organization_invites oi
  join public.organizations o on o.id = oi.organization_id
  where oi.token = p_token
    and oi.status = 'pending'
    and oi.expires_at > now()
  limit 1;
$function$;
--> statement-breakpoint

alter function public.validate_organization_invite_token(text) owner to identity_provisioner;
--> statement-breakpoint
revoke execute on function public.validate_organization_invite_token(text) from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.validate_organization_invite_token(text) to app_runtime;
--> statement-breakpoint

-- Widens the real identity-provisioning function (drizzle/0007) with an
-- optional invite token — DROP+CREATE because adding a parameter changes
-- the function's signature (Postgres would otherwise create a second,
-- ambiguous overload rather than truly replacing it), the same DROP+
-- recreate-with-every-call-site-updated-in-the-same-migration pattern
-- drizzle/0019 already used for a signature change. The no-token branch
-- (the `else`) is byte-for-byte the function's original, unchanged
-- behavior — every existing signup keeps provisioning its own solo
-- organization exactly as before. Only a real, currently-pending,
-- unexpired invite whose email matches the new user's own primary email
-- takes the new branch: join that organization with the invited role
-- instead of creating a new one, and mark the invite accepted — in the
-- same atomic function, so there is never a moment with a real user and
-- no real membership.
drop function if exists public.provision_identity_and_organization(text, text, text, text);
--> statement-breakpoint

create or replace function public.provision_identity_and_organization(
  p_identity_provider text,
  p_identity_provider_subject text,
  p_display_name text,
  p_primary_email text,
  p_invite_token text default null
)
returns table(organization_id uuid, user_id uuid)
security definer
set search_path = ''
language plpgsql
as $function$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_invite_id uuid;
  v_invite_org_id uuid;
  v_invite_role text;
begin
  insert into public.users (identity_provider, identity_provider_subject, display_name, primary_email)
  values (p_identity_provider, p_identity_provider_subject, p_display_name, p_primary_email)
  returning id into v_user_id;

  if p_invite_token is not null then
    select id, organization_id, role
      into v_invite_id, v_invite_org_id, v_invite_role
    from public.organization_invites
    where token = p_invite_token
      and status = 'pending'
      and expires_at > now()
      and lower(email) = lower(p_primary_email)
    limit 1;
  end if;

  if v_invite_id is not null then
    insert into public.memberships (organization_id, user_id, role, status)
    values (v_invite_org_id, v_user_id, v_invite_role, 'active');

    update public.organization_invites
    set status = 'accepted', accepted_at = now(), updated_at = now()
    where id = v_invite_id;

    return query select v_invite_org_id, v_user_id;
  else
    insert into public.organizations (slug, display_name)
    values ('org-' || substr(v_user_id::text, 1, 8), p_display_name || '''s workspace')
    returning id into v_org_id;

    insert into public.memberships (organization_id, user_id, role, status)
    values (v_org_id, v_user_id, 'owner', 'active');

    return query select v_org_id, v_user_id;
  end if;
end;
$function$;
--> statement-breakpoint

alter function public.provision_identity_and_organization(text, text, text, text, text) owner to identity_provisioner;
--> statement-breakpoint
revoke execute on function public.provision_identity_and_organization(text, text, text, text, text) from public, anon, authenticated;
--> statement-breakpoint
grant execute on function public.provision_identity_and_organization(text, text, text, text, text) to app_runtime;
--> statement-breakpoint

-- Passes a pending invite token through from real Supabase Auth signup
-- metadata (`supabase.auth.signUp({ options: { data: { invite_token }}})`
-- — the same `raw_user_meta_data` mechanism this trigger already reads
-- `full_name` from) to the widened function above. Function body only —
-- the trigger binding itself (`on_auth_user_created`) still points at
-- this same-named function and needs no changes.
create or replace function public.handle_new_auth_user()
returns trigger
security definer
set search_path = ''
language plpgsql
as $function$
begin
  perform public.provision_identity_and_organization(
    'supabase',
    new.id::text,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    new.raw_user_meta_data ->> 'invite_token'
  );
  return new;
end;
$function$;
--> statement-breakpoint

alter function public.handle_new_auth_user() owner to identity_provisioner;