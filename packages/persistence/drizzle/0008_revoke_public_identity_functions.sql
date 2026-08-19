-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default, which
-- Supabase's PostgREST layer turns into an anonymous/authenticated RPC
-- endpoint (e.g. POST /rest/v1/rpc/provision_identity_and_organization).
-- These three SECURITY DEFINER functions from 0007 must only be callable
-- from trusted server code (app_runtime) or the auth.users trigger itself
-- -- never directly over the REST API by an unauthenticated or arbitrary
-- signed-in caller. Flagged by mcp__claude_ai_Supabase__get_advisors.
revoke execute on function public.provision_identity_and_organization(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.resolve_memberships_for_identity(text, text) from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
