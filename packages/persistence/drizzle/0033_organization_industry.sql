-- Real per-organization industry classification (ADR 0019), used only to
-- recommend which connector purposes matter most for an org's Business
-- Data Map on /integrations. "unspecified" is the honest default; exactly
-- one real profile ("professional_services") exists in the application
-- layer today, matching this catalog's connectors.

alter table "organizations" add column "industry" text not null default 'unspecified';

alter table "organizations" add constraint "organizations_industry_allowed"
  check ("industry" in ('unspecified', 'professional_services'));
