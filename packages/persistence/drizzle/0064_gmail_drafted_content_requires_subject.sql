-- Real gap found by review: agent_collaborations_drafted_content_consistent
-- was loosened from a strict Gmail-only equality check (subject present iff
-- body present) to a one-directional implication (subject implies body) to
-- accommodate body-only drafts for the four non-Gmail entity types (Asana/
-- HubSpot/Zendesk comment or note, QuickBooks invoice reminder). That
-- loosening applied uniformly, so a message_id-linked (Gmail) collaboration
-- could be marked 'completed' with a real drafted body and a null subject
-- without this constraint ever catching it.
--
-- Verified against both live databases first (0 existing rows match
-- message_id is not null and drafted_content_body is not null and
-- drafted_content_subject is null, in both dev and production) before
-- tightening this constraint, per this repo's own migration discipline.
alter table agent_collaborations
  drop constraint agent_collaborations_drafted_content_consistent;

alter table agent_collaborations
  add constraint agent_collaborations_drafted_content_consistent
  check (
    (drafted_content_subject is null or drafted_content_body is not null)
    and (message_id is null or drafted_content_body is null or drafted_content_subject is not null)
  );
