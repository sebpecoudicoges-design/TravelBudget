import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('public project page visual contract', () => {
  it('uses the official TravelBudget visual tokens and responsive dark palette', () => {
    const page = read('public/projet.html');

    expect(page).toContain('--tb-canvas: #fff9f2');
    expect(page).toContain('--tb-coral: #ff6b4a');
    expect(page).toContain('--tb-lagoon: #23b5af');
    expect(page).toContain('window.matchMedia("(prefers-color-scheme: dark)")');
    expect(page).toContain(':root[data-theme-resolved="dark"]');
    expect(page).toContain('data-project-theme="light"');
    expect(page).toContain('data-project-theme="system"');
    expect(page).toContain('data-project-theme="dark"');
    expect(page).toContain('budgetpacker_project_theme_v1');
    expect(page).toContain(':root[data-theme-resolved="dark"] .project-strip');
    expect(page).toContain(':root[data-theme-resolved="dark"] .control-card');
    expect(page).toContain(':root[data-theme-resolved="dark"] .release-spotlight');
    expect(page).toContain(':root[data-theme-resolved="dark"] .mock-side');
    expect(page).toContain(':root[data-theme-resolved="dark"] .lang-btn.active');
    expect(page).toContain('@media (max-width: 620px)');
  });

  it('keeps the retired Cautions module out of current Project page demos', () => {
    const page = read('public/projet.html');
    expect(page).not.toContain('data-mock-module="cautions"');
    expect(page).not.toContain('data-module="cautions"');
    expect(page).not.toContain('cautions: ["Cautions"');
  });

  it('does not restore the removed admin test or release checklist sections', () => {
    const page = read('public/projet.html');
    const enhancements = read('public/project-enhancements.js');
    const styles = read('public/project-enhancements.css');

    expect(page).not.toContain('id="admin-tests"');
    expect(page).not.toContain('id="checklist"');
    expect(page).not.toContain('adminTests.title');
    expect(page).not.toContain('checklist.title');
    expect(page).toContain('href="https://pecloud.fr/"');
    expect(page).toContain('rel="noopener noreferrer"');
    expect(page).toContain('>Pecloud</a>');
    expect(enhancements).not.toContain('renderChecklist');
    expect(enhancements).not.toContain('checklistStorageKey');
    expect(styles).not.toContain('.project-checklist');
    expect(styles).not.toContain('.checklist-item');
  });
});
