alter table public.caution_deposits
  add column if not exists linked_return_transaction_ids uuid[] not null default '{}',
  add column if not exists settlement_document_ids uuid[] not null default '{}';

create index if not exists caution_deposits_return_tx_ids_gin_idx
  on public.caution_deposits using gin (linked_return_transaction_ids);

create index if not exists caution_deposits_document_ids_gin_idx
  on public.caution_deposits using gin (settlement_document_ids);

update public.caution_deposits
set linked_return_transaction_ids = array[linked_return_transaction_id]
where linked_return_transaction_id is not null
  and coalesce(array_length(linked_return_transaction_ids, 1), 0) = 0;
