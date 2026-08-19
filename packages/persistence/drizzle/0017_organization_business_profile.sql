-- Real per-organization Business Profile — replaces three constants that
-- were hardcoded platform-wide (ORGANIZATION_TIME_ZONE in apps/web,
-- DEFAULT_EXPECTED_RESPONSE_HOURS in the HubSpot mapper, and
-- CRITICAL_VALUE_CENTS in packages/domain) with real per-org settings.
-- Seeded with sensible defaults (UTC, 24 hours, $10,000) so no organization
-- is forced through a setup wizard before getting value — settings, not a
-- gate.

alter table "organizations" add column "timezone" text not null default 'UTC';
alter table "organizations" add column "default_expected_response_hours" integer not null default 24;
alter table "organizations" add column "high_value_threshold_cents" bigint not null default 1000000;

alter table "organizations" add constraint "organizations_timezone_not_blank"
  check (length(btrim("timezone")) > 0);

alter table "organizations" add constraint "organizations_response_hours_positive"
  check ("default_expected_response_hours" > 0);

alter table "organizations" add constraint "organizations_threshold_nonnegative"
  check ("high_value_threshold_cents" >= 0);
