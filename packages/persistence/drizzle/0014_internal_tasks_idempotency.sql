-- internal_tasks had no idempotency mechanism of its own: createInternalTask
-- derived a "unique" audit-event key from a freshly generated task id on
-- every call, so a genuine retry (double form submission, network retry)
-- could never be detected and always created a second, duplicate task. This
-- adds a real caller-supplied idempotency key to the table itself, matching
-- the pattern already used by source_records (0000) and integrations.

alter table "internal_tasks" add column "idempotency_key" text;

update "internal_tasks"
set "idempotency_key" = 'legacy:' || "id"::text
where "idempotency_key" is null;

alter table "internal_tasks" alter column "idempotency_key" set not null;

alter table "internal_tasks" add constraint "internal_tasks_idempotency_key_not_blank"
  check (length(btrim("idempotency_key")) > 0);

alter table "internal_tasks" add constraint "internal_tasks_org_idempotency_unique"
  unique ("organization_id", "idempotency_key");
