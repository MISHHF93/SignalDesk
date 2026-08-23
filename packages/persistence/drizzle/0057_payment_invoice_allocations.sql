-- Replaces payments.linked_invoice_external_ids (text[]) with
-- invoice_allocations (jsonb: {externalInvoiceId, amountCents}[]).
--
-- The old column could only record *which* invoices a payment touched,
-- never how much of the payment applied to each one. A single bulk
-- payment settling several invoices made every one of them independently
-- claim the payment's *full* amount as received (packages/dependencies's
-- resolvePaymentInvoiceDependencies used `payment.amountCents` for every
-- linked invoice) -- a real over-attribution bug in aggregate, tracked
-- since the initial self-healing pass on this app.
alter table payments
  add column invoice_allocations jsonb not null default '[]'::jsonb;

-- Backfill every existing row from the data it already has. Every real
-- row in this database carries exactly one linked invoice today, so an
-- even split across linked_invoice_external_ids is each row's real,
-- exact amount, not an approximation. Written as an even split rather
-- than repeating the full amount per invoice so it stays an honest
-- best-effort figure (not a re-introduction of the bug above) if a
-- historical multi-invoice row is ever found.
update payments
set invoice_allocations = (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'externalInvoiceId', eid,
        'amountCents', amount_cents / array_length(linked_invoice_external_ids, 1)
      )
    ),
    '[]'::jsonb
  )
  from unnest(linked_invoice_external_ids) as eid
)
where array_length(linked_invoice_external_ids, 1) > 0;

alter table payments
  drop column linked_invoice_external_ids;
