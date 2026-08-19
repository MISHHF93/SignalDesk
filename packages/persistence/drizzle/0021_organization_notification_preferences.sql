-- Real notification preferences — replaces the Preferences card's
-- hardcoded "Example default: on/on/off" read-only examples with actual
-- per-organization settings. Scoped to the organization, not the signed-in
-- user: today's identity model provisions exactly one owner per
-- organization (no team invites yet, per ADR 0005), so there is no real
-- distinction yet between "this org's preferences" and "this person's
-- preferences" — per-user scoping can be introduced if/when real team
-- membership exists, without this column set changing shape.
-- Defaults match the exact examples already shown in the UI.

alter table "organizations" add column "morning_brief_enabled" boolean not null default true;
alter table "organizations" add column "attention_alerts_enabled" boolean not null default true;
alter table "organizations" add column "weekly_recap_enabled" boolean not null default false;
