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

  it('keeps the redesigned first fold compact, bilingual and mobile-safe', () => {
    const page = read('public/projet.html');
    const styles = read('public/project-enhancements.css');

    expect(page).toContain('Ton budget, tes documents et tes objectifs. Un seul cockpit.');
    expect(page).toContain('Your budget, documents and goals. One cockpit.');
    expect(page).toContain('class="hero-status"');
    expect(page).toContain('data-i18n="status.release"');
    expect(page).toContain('data-i18n="status.mobile"');
    expect(page).toContain('class="hero-status-item owner"');
    expect(page).not.toContain('class="metrics"');
    expect(page).not.toContain('class="trust-strip"');
    expect(page).not.toContain('.project-strip');
    expect(page).not.toContain('.project-badge');
    expect(styles).toContain('/* 10.5.359 — Project page hierarchy and responsive first fold. */');
    expect(styles).toContain('.hero-status {');
    expect(styles).toContain('.nav-actions > .btn { display: none; }');
    expect(styles).toContain('.floating-lang { display: none; }');
  });

  it('opens one focused Project page retest for 10.5.359', () => {
    const migration = read('supabase/migrations/20260829082147_project_page_visual_10_5_359.sql');

    expect(migration).toContain("module.module_key = 'project'");
    expect(migration).toContain('Page Projet compacte et responsive 10.5.359');
    expect(migration).toContain("lower('seb.pecoud@gmail.com')");
    expect(migration).toContain("set app_version = '10.5.359'");
  });
});
