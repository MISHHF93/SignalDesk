-- Real per-organization working-days configuration, closing the gap the
-- Configuration Readiness Report flagged as a P0: elapsed-time calculations
-- (getLeadAttention -> evaluateUntouchedLead) were pure wall-clock hours,
-- so a lead created Friday evening at a Mon-Fri business would read as
-- neglected by Saturday morning, well before the business was ever open to
-- respond. Bit n (0 = Sunday, matching JS Date.getUTCDay()) set means day n
-- is a working day. Default 62 = 0b0111110 = Mon-Fri.

alter table "organizations" add column "working_days_bitmask" smallint not null default 62;

alter table "organizations" add constraint "organizations_working_days_bitmask_range"
  check ("working_days_bitmask" between 0 and 127);
