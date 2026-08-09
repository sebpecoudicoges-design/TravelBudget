import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('tester campaign contract', () => {
  it('keeps the tester tab, view and centralized navigation guard', () => {
    const index = read('index.html');
    const navigation = read('public/legacy/js/10_navigation.js');
    expect(index).toContain('id="tab-testing"');
    expect(index).toContain('id="view-testing"');
    expect(index).toContain('id="testing-root"');
    expect(index).toContain('id="view-validation"');
    expect(navigation).toContain('access.resolveAppView(view, window.sbRole)');
    expect(navigation).toContain('window.renderTestCampaignApp("navigation")');
    expect(navigation).toContain('document.body.classList.toggle("tb-role-test"');
  });

  it('prevents the browser bootstrap from choosing its own profile role', () => {
    const bootstrap = read('public/legacy/js/07_supabase_bootstrap.js');
    const insertBlock = bootstrap.slice(bootstrap.indexOf('if (!prof) {'), bootstrap.indexOf('// 2) Ensure settings'));
    const profileInsert = insertBlock.match(/\.profiles\)\.insert\(\[([\s\S]*?)\]\)/)?.[1] || '';
    expect(profileInsert).not.toContain('role:');
  });

  it('keeps migration RLS and explicit grants for the exposed campaign tables', () => {
    const migration = read('supabase/migrations/20260801070338_module_test_campaign.sql');
    expect(migration).toContain('alter table public.app_test_results enable row level security');
    expect(migration).toContain("lower(p.role) in ('admin', 'test')");
    expect(migration).toContain('user_id = (select auth.uid())');
    expect(migration).toContain('grant select, insert, update on public.app_test_results');
    expect(migration).toContain('revoke insert, update on public.profiles from authenticated');
    expect(migration).toContain('grant update (email, whatsapp_phone_e164) on public.profiles to authenticated');
  });

  it('lets admins assign only user or test through a verified server function', () => {
    const members = read('public/legacy/js/30_members_admin.js');
    const edge = read('supabase/functions/admin-set-user-role/index.ts');
    const config = read('supabase/config.toml');
    expect(members).toContain('callEdge("admin-set-user-role"');
    expect(edge).toContain("String(callerProfile?.role || \"\").toLowerCase() !== \"admin\"");
    expect(edge).toContain("!['user', 'test'].includes(role)");
    expect(edge).toContain('targetUserId === callerId');
    expect(config).toContain('[functions.admin-set-user-role]\nverify_jwt = true');
  });

  it('closes handled and clean results globally while opening linked 10.5.325 retests', () => {
    const migration = read('supabase/migrations/20260808064500_process_ui_stability_feedback_10_5_325.sql');

    expect(migration).toContain("closed_version = coalesce(s.closed_version, '10.5.325')");
    expect(migration).toContain("treated_version = coalesce(r.treated_version, '10.5.325')");
    expect(migration.match(/'32500000-0000-4000-8000-00000000000[1-4]'/g)).toHaveLength(4);
    expect(migration).toContain("'Retest premier chargement 10.5.325'");
    expect(migration).toContain("'Retest notifications Transactions 10.5.325'");
    expect(migration).toContain("'Retest grille Compte 10.5.325'");
    expect(migration).toContain("'Retest aides persistantes 10.5.325'");
    expect(migration).toContain("set app_version = '10.5.325'");
  });

  it('archives the validated retests and chains only the failed Dashboard retest in 10.5.326', () => {
    const migration = read('supabase/migrations/20260808064543_process_dashboard_boot_retest_10_5_326.sql');

    expect(migration).toContain("closed_version = coalesce(s.closed_version, '10.5.326')");
    expect(migration).toContain("treated_version = coalesce(r.treated_version, '10.5.326')");
    expect(migration).toContain("'32600000-0000-4000-8000-000000000001'::uuid");
    expect(migration).toContain("parent.id");
    expect(migration).toContain("'Retest role et premier Dashboard 10.5.326'");
    expect(migration).toContain("set app_version = '10.5.326'");
    expect(migration).not.toContain('Retest bouton Archiver 10.5.326');
  });

  it('adds Immobilisation safely and reopens the real Wallet archive feedback in 10.5.327', () => {
    const migration = read('supabase/migrations/20260808073835_add_immobilisation_and_wallet_archive_retest_10_5_327.sql');

    expect(migration).toContain("(v_user_id, 'Immobilisation', '#64748b', 18)");
    expect(migration).toContain("lower(c.name) = lower('Immobilisation')");
    expect(migration).toContain("'Immobilisation', null, 'excluded', null");
    expect(migration).toContain('revoke execute on function public.seed_default_categories_for_user() from public, anon');
    expect(migration).toContain("'Retest Archiver dans la carte wallet 10.5.327'");
    expect(migration).toContain("'Retest categorie Immobilisation 10.5.327'");
    expect(migration).toContain("set app_version = '10.5.327'");
  });

  it('reopens validated finance modules and links the focused Trip retest in 10.5.328', () => {
    const migration = read('supabase/migrations/20260808235452_reopen_validated_modules_and_trip_retest_10_5_328.sql');

    expect(migration).toContain("and module_key in ('dashboard', 'transactions', 'analysis')");
    expect(migration).toContain("set status = 'open'");
    expect(migration).toContain("'32800000-0000-4000-8000-000000000001'::uuid");
    expect(migration).toContain("'Retest saisie rapide Trip 10.5.328'");
    expect(migration).toContain("parent.id");
    expect(migration).toContain("set app_version = '10.5.328'");
  });

  it('archives all three Assets notes and creates linked 10.5.329 retests', () => {
    const migration = read('supabase/migrations/20260809001212_process_asset_feedback_10_5_329.sql');

    expect(migration).toContain("'aeaa6419-581d-af42-669a-a4a5a0ae1c70'::uuid");
    expect(migration).toContain("'24ad8b95-a412-e43d-8ce2-0b094838bce2'::uuid");
    expect(migration).toContain("'557bab35-de8b-ccf8-45f3-5c0c5b51ca00'::uuid");
    expect(migration.match(/'32900000-0000-4000-8000-00000000000[1-3]'::uuid/g)).toHaveLength(3);
    expect(migration).toContain('Retest clarte cycle actif Patrimoine 10.5.329');
    expect(migration).toContain('Retest liens financiers Patrimoine 10.5.329');
    expect(migration).toContain('Retest documents Patrimoine 10.5.329');
    expect(migration).toContain("set app_version = '10.5.329'");
  });

  it('closes the Categories feedback with owner-scoped 10.5.330 RPCs and a linked retest', () => {
    const migration = read('supabase/migrations/20260809003033_settings_categories_feedback_10_5_330.sql');

    expect(migration).toContain('security invoker');
    expect(migration).toContain('revoke all on function public.rename_category_bundle(text, text, text) from public, anon');
    expect(migration).toContain('revoke all on function public.delete_subcategory_bundle(text, text) from public, anon');
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain('Retest gestion Categories Settings 10.5.330');
    expect(migration).toContain("set app_version = '10.5.330'");

    const reviewMigration = read('supabase/migrations/20260809005159_archive_settings_module_review_10_5_330.sql');
    expect(reviewMigration).toContain("module.module_key = 'settings'");
    expect(reviewMigration).toContain("treated_version, '10.5.330'");
    expect(reviewMigration).toContain('archived_at = coalesce');
  });
});
