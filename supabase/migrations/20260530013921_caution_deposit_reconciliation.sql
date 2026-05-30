alter table public.caution_deposits
  add column if not exists linked_paid_transaction_id uuid,
  add column if not exists linked_return_transaction_id uuid,
  add column if not exists settlement_status text not null default 'open'
    check (settlement_status in ('open', 'settled', 'partial', 'lost', 'disputed')),
  add column if not exists settlement_note text,
  add column if not exists settlement_document_url text,
  add column if not exists settlement_document_label text;

create index if not exists caution_deposits_paid_tx_idx
  on public.caution_deposits (linked_paid_transaction_id)
  where linked_paid_transaction_id is not null;

create index if not exists caution_deposits_return_tx_idx
  on public.caution_deposits (linked_return_transaction_id)
  where linked_return_transaction_id is not null;
