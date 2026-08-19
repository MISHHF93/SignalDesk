-- organization_subscription_addons is real current-state config, not
-- append-only audit data, and its own quantity>0 check constraint (0022)
-- rules out a "quantity 0 = removed" soft-delete convention the way
-- other tables in this codebase avoid DELETE — removing an add-on
-- genuinely needs a hard delete. Caught by a live test, not assumed.
grant delete on public.organization_subscription_addons to app_runtime;
