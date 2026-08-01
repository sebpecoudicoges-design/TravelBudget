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
    expect(page).toContain('@media (prefers-color-scheme: dark)');
    expect(page).toContain('@media (max-width: 620px)');
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
