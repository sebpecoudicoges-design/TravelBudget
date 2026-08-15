import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Abonnements module contract', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');
  const navigation = fs.readFileSync('public/legacy/js/10_navigation.js', 'utf8');
  const recurring = fs.readFileSync('public/legacy/js/15_recurring_rules_ui.js', 'utf8');
  const transactionModal = fs.readFileSync('public/legacy/js/16_modal_add_edit_via_rpc.js', 'utf8');
  const transactions = fs.readFileSync('public/legacy/js/13_transactions_view.js', 'utf8');

  it('owns a dedicated lazy financial view outside Settings', () => {
    expect(html).toContain('id="tab-subscriptions"');
    expect(html).toContain('id="view-subscriptions"');
    expect(html).toContain('id="subscriptions-root"');
    expect(main).toContain("subscriptions: [");
    expect(main).not.toMatch(/BOOT_LEGACY_SCRIPTS[\s\S]*15_recurring_rules_ui\.js[\s\S]*const OPTIONAL_SCRIPTS/);
    expect(navigation).toContain('view === "subscriptions"');
    expect(recurring).toContain('_rrEnsureSubscriptionsBox');
    expect(recurring).not.toContain('_rrEnsureSettingsBox');
  });

  it('keeps automatic rule links and exposes manual transaction linking', () => {
    expect(html).toContain('id="m-recurring-rule"');
    expect(transactionModal).toContain('fillModalRecurringSelect');
    expect(transactionModal).toContain('link_transaction_to_recurring_rule');
    expect(transactionModal).toContain('generatedByRule');
    expect(recurring).toContain('id="rr-tracking-mode"');
    expect(recurring).toContain('save_subscription_rule_v3');
    expect(transactions).toContain('applyBulkTxSubscription');
    expect(transactions).toContain('link_transactions_to_recurring_rule');
  });
});
