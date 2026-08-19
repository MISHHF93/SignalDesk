-- Catalog tables are intentionally read-only for app_runtime (0022) —
-- new prices/entitlements/add-ons are migration-managed, not written by
-- application code. One real exception: a successful checkout that
-- redeems a promotional price must increment that price's own redemption
-- counter as routine customer-facing traffic, not an admin action. Column-
-- level grant, not a blanket UPDATE on plan_prices, so nothing else about
-- a price (amount, Stripe ids, active window) becomes writable by the app.
grant update (promo_redemptions_count) on public.plan_prices to app_runtime;
