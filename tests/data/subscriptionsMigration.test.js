import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('subscriptions migration', () => {
  const sql = fs.readFileSync('supabase/migrations/20260815034127_subscriptions_module_10_5_349.sql', 'utf8');
  const hardeningSql = fs.readFileSync('supabase/migrations/20260815035227_harden_subscription_link_rpc_10_5_349.sql', 'utf8');
  const trackingSql = fs.readFileSync('supabase/migrations/20260815054038_subscription_tracking_and_bulk_link_10_5_350.sql', 'utf8');
  const saveHardeningSql = fs.readFileSync('supabase/migrations/20260815055028_harden_subscription_save_rpc_10_5_350.sql', 'utf8');
  const relinkSql = fs.readFileSync('supabase/migrations/20260815074159_allow_safe_generated_subscription_relink_10_5_351.sql', 'utf8');
  const cashSummaryTestSql = fs.readFileSync('supabase/migrations/20260815075831_extend_subscription_cash_summary_test_10_5_351.sql', 'utf8');

  it('secures manual transaction linkage by ownership and domain compatibility', () => {
    expect(sql).toContain('create or replace function public.link_transaction_to_recurring_rule');
    expect(sql).toContain('v_user_id uuid := auth.uid()');
    expect(sql).toContain('same travel');
    expect(sql).toContain('same type');
    expect(sql).toContain('same currency');
    expect(sql).toContain('Generated occurrences keep their automatic recurring rule link');
    expect(sql).toContain('revoke all on function public.link_transaction_to_recurring_rule');
    expect(hardeningSql).toContain('security invoker');
  });

  it('fixes trigger permissions and secures manual-only and bulk workflows', () => {
    expect(trackingSql).toContain('add column if not exists tracking_only');
    expect(trackingSql).toContain('alter function public.recurring_align_rule_first_due() security definer');
    expect(trackingSql).toContain('create or replace function public.save_subscription_rule_v3');
    expect(trackingSql).toContain('create or replace function public.link_transactions_to_recurring_rule');
    expect(trackingSql).toContain('Generated occurrences keep their automatic recurring rule link');
    expect(trackingSql).toContain("app_version = '10.5.350'");
    expect(saveHardeningSql).toContain('security invoker');
    expect(saveHardeningSql).toContain('from public, anon');
  });

  it('adds the dedicated module and four functional retests to the active campaign', () => {
    expect(sql).toContain("'subscriptions'");
    expect(sql).toContain("'Abonnements'");
    expect(sql.match(/34900000-0000-4000-8000-00000000000[1-4]/g)).toHaveLength(4);
    expect(sql).toContain("app_version = '10.5.349'");
  });

  it('turns a reclassified generated occurrence into a protected manual transaction', () => {
    expect(relinkSql).toContain('p_recurring_rule_id is not distinct from v_transaction.recurring_rule_id');
    expect(relinkSql).toContain('set generated_by_rule = false');
    expect(relinkSql).toContain("recurring_instance_status = 'detached'");
    expect(relinkSql).toContain('security invoker');
    expect(relinkSql).toContain('from public, anon');
    expect(relinkSql).toContain("app_version = '10.5.351'");
  });

  it('extends the existing visual retest with cash totals and calendar presets', () => {
    expect(cashSummaryTestSql).toContain("scenario.id = '35100000-0000-4000-8000-000000000002'::uuid");
    expect(cashSummaryTestSql).toContain('Total depenses, Total revenus et Difference');
    expect(cashSummaryTestSql).toContain('Mois dernier et Semaine derniere');
  });
});
