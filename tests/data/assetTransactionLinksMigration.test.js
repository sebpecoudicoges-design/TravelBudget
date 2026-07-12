import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('asset transaction links migration', () => {
  const sql = fs.readFileSync('supabase/migrations/20260712004235_asset_transaction_links_budget_policy.sql', 'utf8');

  it('creates typed asset links for wallet transactions and Trip expenses', () => {
    expect(sql).toContain('create table if not exists public.asset_transaction_links');
    expect(sql).toContain('transaction_id uuid references public.transactions');
    expect(sql).toContain('trip_expense_id uuid references public.trip_expenses');
    expect(sql).toContain("relation_type in ('purchase','extra_cost','sale','maintenance','insurance','financing','trip_expense','other')");
    expect(sql).toContain('exclude_from_budget boolean not null default false');
  });

  it('protects links with RLS and prevents duplicate links per asset movement', () => {
    expect(sql).toContain('alter table public.asset_transaction_links enable row level security');
    expect(sql).toContain('asset_transaction_links_asset_tx_uidx');
    expect(sql).toContain('asset_transaction_links_asset_trip_expense_uidx');
    expect(sql).toContain('grant select, insert, update, delete on table public.asset_transaction_links to authenticated');
  });
});
