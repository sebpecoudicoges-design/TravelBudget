import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('settings shared modal migration', () => {
  const source = fs.readFileSync('public/legacy/js/14_settings_periods_ui.js', 'utf8');
  const settingsView = fs.readFileSync('src/features/settings/settingsView.js', 'utf8');
  const categoriesView = fs.readFileSync('src/features/settings/settingsCategoriesView.js', 'utf8');

  it('routes Settings forms through the shared accessible modal', () => {
    expect(source).toContain('window.UI.createModal({');
    expect(source).toContain('id: "tb-settings-shared-modal"');
    expect(source).toContain('data-tb-settings-modal-action');
    expect(source).toContain('initialFocus,');
    expect(source).toContain('setOnDismiss(callback)');
  });

  it('keeps all four Settings workflows on the common adapter', () => {
    expect(source.match(/const modal = _tbEnsureModal\(\);/g)).toHaveLength(4);
    expect(source).toContain('modal.setTitle("Nouveau voyage")');
    expect(source).toContain('modal.setTitle("Ajouter une période")');
    expect(source).toContain("modal.setTitle(defaults.title || 'Nouvelle catégorie')");
    expect(source).toContain('modal.setTitle(defaults.title || `Nouvelle sous-catégorie');
  });

  it('removes the legacy Settings backdrop and inline modal shell', () => {
    expect(source).not.toContain('el.id = "tb-modal"');
    expect(source).not.toContain('el.style.position="fixed"');
    expect(source).not.toContain('id="tb-modal-actions"');
  });

  it('associates each editable Settings field with its label', () => {
    for (const id of ['tb-vstart', 'tb-vend', 'tb-pstart', 'tb-pend', 'tb-pcur', 'tb-pbud']) {
      expect(settingsView).toContain(`for="${id}"`);
      expect(settingsView).toContain(`id="${id}"`);
    }
    for (const id of ['tb-cat-create-name', 'tb-cat-create-color', 'tb-cat-create-mapping', 'tb-subcat-create-name', 'tb-subcat-create-color', 'tb-subcat-create-mapping']) {
      expect(categoriesView).toContain(`for="${id}"`);
      expect(categoriesView).toContain(`id="${id}"`);
    }
  });
});
