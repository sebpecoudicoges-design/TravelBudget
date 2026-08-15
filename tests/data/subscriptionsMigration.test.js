import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('subscriptions migration', () => {
  const sql = fs.readFileSync('supabase/migrations/20260815034127_subscriptions_module_10_5_349.sql', 'utf8');
  const hardeningSql = fs.readFileSync('supabase/migrations/20260815035227_harden_subscription_link_rpc_10_5_349.sql', 'utf8');

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

  it('adds the dedicated module and four functional retests to the active campaign', () => {
    expect(sql).toContain("'subscriptions'");
    expect(sql).toContain("'Abonnements'");
    expect(sql.match(/34900000-0000-4000-8000-00000000000[1-4]/g)).toHaveLength(4);
    expect(sql).toContain("app_version = '10.5.349'");
  });
});
