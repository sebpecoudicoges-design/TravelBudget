import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('recurring rule reconciliation migration', () => {
  const migration = fs.readFileSync(
    'supabase/migrations/20260815002750_reconcile_recurring_rule_updates.sql',
    'utf8',
  );
  const alignmentMigration = fs.readFileSync(
    'supabase/migrations/20260815003657_restrict_recurring_reconcile_helpers.sql',
    'utf8',
  );
  const subscriptionTrackingMigration = fs.readFileSync(
    'supabase/migrations/20260815054038_subscription_tracking_and_bulk_link_10_5_350.sql',
    'utf8',
  );
  const recurringUi = fs.readFileSync('public/legacy/js/15_recurring_rules_ui.js', 'utf8');
  const transactionUi = fs.readFileSync('public/legacy/js/16_modal_add_edit_via_rpc.js', 'utf8');

  it('aligns the first weekly due date with the selected weekday', () => {
    expect(migration).toContain("when 'weekly' then");
    expect(migration).toContain('extract(dow from p_start_date)');
    expect(migration).toContain('p_weekday - extract(dow from p_start_date)::integer + 7');
    expect(recurringUi).toContain('7 * Number(intervalCount)');
    expect(alignmentMigration).toContain('v_first_due := v_first_due + (7 * r.interval_count)');
    expect(alignmentMigration).toContain("rule_type = 'weekly'");
    expect(alignmentMigration).toContain('interval_count > 1');
  });

  it('replaces only mutable generated projections', () => {
    expect(migration).toContain("coalesce(t.recurring_instance_status, 'generated') = 'generated'");
    expect(migration).toContain('coalesce(t.pay_now, false) = false');
    expect(migration).toContain('delete from public.transactions t');
    expect(migration).toContain('public.recurring_generate_for_rule(r.id)');
  });

  it('protects manually customized occurrences before a rule edit', () => {
    expect(migration).toContain("set recurring_instance_status = 'detached'");
    expect(migration).toContain('t.date_start is distinct from t.occurrence_date');
    expect(migration).toContain('t.amount is distinct from r.amount');
    expect(migration).toContain("v_new_status := case when coalesce(p_pay_now, false) then 'confirmed' else 'detached' end");
    expect(transactionUi).toContain('payload.pay_now ? "confirmed" : "detached"');
  });

  it('uses one secured database operation instead of client-side bulk mutation', () => {
    expect(migration).toContain('create or replace function public.recurring_update_rule_v2');
    expect(migration).toContain("v_uid uuid := auth.uid()");
    expect(migration).toContain('revoke all on function public.recurring_update_rule_v2');
    expect(subscriptionTrackingMigration).toContain('public.recurring_update_rule_v2(');
    expect(recurringUi).toContain('save_subscription_rule_v3');
    expect(recurringUi).not.toContain('_rrSyncGeneratedTransactions');
    expect(recurringUi).not.toContain('.from(TB_CONST.TABLES.recurring_rules)\n      .update(updatePayload)');
  });
});
