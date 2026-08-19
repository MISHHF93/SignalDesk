-- Closes a real gap the Launch Wiring Report flagged: the UI never showed
-- which specific account/workspace was connected, only a boolean
-- "Connected." A nullable label — the HubSpot portal name isn't returned
-- by its token exchange response, so it stays null there for now; Slack's
-- oauth.v2.access response does return team.name, so its connector can
-- populate this from day one.

alter table public.integrations add column external_account_label text;
