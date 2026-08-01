import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

describe('initial boot loader contract', () => {
  it('renders a visible progressive loader with TB version before legacy boot finishes', () => {
    const index = read('index.html');

    expect(index).toContain('id="tb-boot-overlay"');
    expect(index).toContain('id="tb-boot-percent"');
    expect(index).toContain('id="tb-boot-progress"');
    expect(index).toContain('id="tb-boot-version"');
    expect(index).toContain('Version TB');
    expect(index).toContain('window.TB_VERSION');
    expect(index).toContain('Préparation de votre espace');
    expect(index).toContain('Vos données restent dans votre espace privé');
  });

  it('forces 100% before hiding and exposes staged boot progress', () => {
    const boot = read('public/legacy/js/20_boot.js');

    expect(boot).toContain('function tbSetBootProgress(progress, text, phase)');
    expect(boot).toContain('tbSetBootProgress(100, "Prêt", "ready")');
    expect(boot).toContain('tbShowBootOverlay("Initialisation de l’application", 12, "data")');
    expect(boot).toContain('tbShowBootOverlay("Connexion et synchronisation…", 34, "data")');
    expect(boot).toContain('tbShowBootOverlay("Chargement des transactions, wallets et graphiques…", 72, "sync")');
  });

  it('keeps the premium coral and lagoon skin in index.html without restoring the old tech grid', () => {
    const index = read('index.html');
    const boot = read('public/legacy/js/20_boot.js');

    expect(index).toContain('@keyframes tbBootBreathe');
    expect(index).toContain('var(--tb-coral,#ff6b4a)');
    expect(index).toContain('var(--tb-lagoon,#23b5af)');
    expect(index).not.toContain('@keyframes tbBootSweep');
    expect(boot).not.toContain('repeating-linear-gradient(90deg');
  });
});
