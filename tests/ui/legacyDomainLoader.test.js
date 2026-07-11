import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('legacy domain loader', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const navigation = fs.readFileSync('public/legacy/js/10_navigation.js', 'utf8');
  const offlineQueue = fs.readFileSync('public/legacy/js/00_offline_queue.js', 'utf8');
  const assetsUi = fs.readFileSync('public/legacy/js/42_assets_ui.js', 'utf8');
  const inboxUi = fs.readFileSync('public/legacy/js/44_inbox_ui.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');

  it('keeps Assets out of the boot legacy list and registers it as a deferred domain', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/41_assets_core.js');
    expect(bootList).not.toContain('/legacy/js/42_assets_ui.js');
    expect(domains).toContain('assets:');
    expect(domains).toContain('/legacy/js/41_assets_core.js');
    expect(domains).toContain('/legacy/js/42_assets_ui.js');
    expect(main).toContain('window.tbLoadLegacyDomain');
  });

  it('loads the Assets domain before rendering the Assets view when needed', () => {
    expect(navigation).toContain('window.tbLoadLegacyDomain("assets")');
    expect(navigation).toContain('renderAssets("navigation:lazy")');
  });

  it('keeps Cautions out of boot and lazy-loads it before rendering the Cautions view', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/46_cautions_ui.js');
    expect(domains).toContain('cautions:');
    expect(domains).toContain('/legacy/js/46_cautions_ui.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("cautions")');
    expect(navigation).toContain('renderCautions("navigation:lazy")');
    expect(index).toContain('id="tab-cautions"');
    expect(index).toContain('id="view-cautions"');
    expect(index).toContain('id="cautions-root"');
  });

  it('keeps Documents out of boot and lazy-loads it before rendering the Documents view', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/43_documents_ui.js');
    expect(domains).toContain('documents:');
    expect(domains).toContain('/legacy/js/43_documents_ui.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("documents")');
    expect(navigation).toContain('renderDocuments("navigation:lazy")');
    expect(index).toContain('id="tab-documents"');
    expect(index).toContain('id="view-documents"');
    expect(index).toContain('id="documents-root"');
    expect(assetsUi).toContain("await window.tbLoadLegacyDomain('documents')");
    expect(assetsUi).toContain('window.tbDocumentsPreview?.(docId)');
    expect(inboxUi).toContain("await window.tbLoadLegacyDomain('documents')");
    expect(inboxUi).toContain("window.renderDocuments('inbox-classified')");
  });

  it('keeps Nutrition out of boot and lazy-loads it before rendering the Nutrition view', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/48_nutrition_ui.js');
    expect(domains).toContain('nutrition:');
    expect(domains).toContain('/legacy/js/48_nutrition_ui.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("nutrition")');
    expect(navigation).toContain('renderNutrition("navigation:lazy")');
    expect(index).toContain('id="tab-nutrition"');
    expect(index).toContain('id="view-nutrition"');
    expect(index).toContain('id="nutrition-root"');
  });

  it('keeps Work out of boot and lazy-loads it before rendering the Work view', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/47_work_ui.js');
    expect(bootList).not.toContain('/legacy/js/50_work_career_ui.js');
    expect(domains).toContain('work:');
    expect(domains).toContain('/legacy/js/47_work_ui.js');
    expect(domains).toContain('/legacy/js/50_work_career_ui.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("work")');
    expect(navigation).toContain('renderWork("navigation:lazy")');
    expect(index).toContain('id="tab-work"');
    expect(index).toContain('id="view-work"');
    expect(index).toContain('id="work-root"');
  });

  it('keeps Trip and Members out of boot and lazy-loads them before rendering related views', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/29_trip_v1.js');
    expect(bootList).not.toContain('/legacy/js/30_members_admin.js');
    expect(domains).toContain('trip:');
    expect(domains).toContain('/legacy/js/29_trip_v1.js');
    expect(domains).toContain('/legacy/js/30_members_admin.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("trip")');
    expect(navigation).toContain('window.renderTrip("navigation:lazy")');
    expect(navigation).toContain('window.renderMembersAdmin("navigation:lazy")');
    expect(index).toContain('id="tab-trip"');
    expect(index).toContain('id="view-trip"');
    expect(index).toContain('id="trip-root"');
    expect(index).toContain('id="tab-members"');
    expect(index).toContain('id="view-members"');
    expect(index).toContain('id="members-root"');
  });

  it('keeps Sport out of boot and lazy-loads it before rendering or replaying local sync', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/45_sport_ui.js');
    expect(domains).toContain('sport:');
    expect(domains).toContain('/legacy/js/45_sport_ui.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("sport")');
    expect(navigation).toContain('renderSport("navigation:lazy")');
    expect(offlineQueue).toContain('await window.tbLoadLegacyDomain("sport")');
    expect(offlineQueue).toContain('await window.tbSportSyncLocalWorkouts()');
    expect(index).toContain('id="tab-sport"');
    expect(index).toContain('id="view-sport"');
    expect(index).toContain('id="sport-root"');
  });

  it('keeps Notifications settings out of boot and lazy-loads them before rendering the Notifications view', () => {
    const bootList = main.slice(main.indexOf('const BOOT_LEGACY_SCRIPTS'), main.indexOf('const OPTIONAL_SCRIPTS'));
    const domains = main.slice(main.indexOf('const LEGACY_DOMAIN_SCRIPTS'), main.indexOf('const legacyDomainPromises'));

    expect(bootList).not.toContain('/legacy/js/49_notifications_ui.js');
    expect(domains).toContain('notifications:');
    expect(domains).toContain('/legacy/js/49_notifications_ui.js');
    expect(navigation).toContain('window.tbLoadLegacyDomain("notifications")');
    expect(navigation).toContain('renderNotifications("navigation:lazy")');
    expect(index).toContain('id="tab-notifications"');
    expect(index).toContain('id="view-notifications"');
    expect(index).toContain('id="notifications-root"');
  });
});
