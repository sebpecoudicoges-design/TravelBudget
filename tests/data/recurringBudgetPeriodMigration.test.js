import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('recurring budget period migration', () => {
  const sql = fs.readFileSync('supabase/migrations/20260703122116_harden_recurring_budget_periods.sql', 'utf8');
  const preserveSql = fs.readFileSync('supabase/migrations/20260704223726_preserve_recurring_budget_dates.sql', 'utf8');
  const trimSql = fs.readFileSync('supabase/migrations/20260703123153_trim_recurring_occurrences_over_limit.sql', 'utf8');
  const walletViewsSql = fs.readFileSync('supabase/migrations/20260703123941_secure_wallet_views.sql', 'utf8');

  it('assigns generated rows from their occurrence date', () => {
    expect(sql).toContain('recurring_assign_budget_period');
    expect(sql).toContain('get_period_for_travel_date(v_rule.travel_id, v_budget_date)');
    expect(sql).toContain('new.period_id := v_period_id');
  });

  it('repairs only mutable generated occurrences', () => {
    expect(sql).toContain("coalesce(t.recurring_instance_status, 'generated') <> 'confirmed'");
    expect(sql).toContain('coalesce(t.pay_now, false) = false');
  });

  it('preserves custom budget ranges while resolving their period', () => {
    expect(preserveSql).toContain('v_budget_start := coalesce(new.budget_date_start, v_occurrence_date)');
    expect(preserveSql).toContain('v_budget_end := coalesce(new.budget_date_end, v_budget_start)');
    expect(preserveSql).toContain('get_period_for_travel_date(v_rule.travel_id, v_budget_start)');
    expect(preserveSql).not.toContain('budget_date_start = coalesce(t.occurrence_date');
    expect(preserveSql).not.toContain('budget_date_end = coalesce(t.occurrence_date');
  });

  it('enforces max occurrences while generating', () => {
    expect(sql).toContain('v_occurrence_count >= r.max_occurrences');
    expect(sql).toContain('v_occurrence_count := v_occurrence_count + 1');
  });

  it('trims only unpaid generated projections above the limit', () => {
    expect(trimSql).toContain('greatest(c.max_occurrences - c.confirmed_count, 0)');
    expect(trimSql).toContain('coalesce(t.pay_now, false) = false');
    expect(trimSql).toContain("coalesce(t.recurring_instance_status, 'generated') <> 'confirmed'");
    expect(trimSql).toContain('delete from public.transactions');
  });

  it('keeps wallet views under the querying user RLS context', () => {
    expect(walletViewsSql.match(/security_invoker = true/g)).toHaveLength(2);
    expect(walletViewsSql).toContain('public.v_wallet_transactions_effect');
    expect(walletViewsSql).toContain('public.v_wallet_balances');
  });
});
