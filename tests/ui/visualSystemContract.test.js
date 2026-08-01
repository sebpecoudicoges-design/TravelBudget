import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('visual system contract', () => {
  const rules = fs.readFileSync('docs/VISUAL_SYSTEM.md', 'utf8');
  const agents = fs.readFileSync('AGENTS.md', 'utf8');
  const theme = fs.readFileSync('src/ui/premium-theme.css', 'utf8');
  const main = fs.readFileSync('src/main.js', 'utf8');

  it('declares the visual system as the mandatory UI reference', () => {
    expect(rules).toContain('référence obligatoire');
    expect(rules).toContain('Conservation fonctionnelle');
    expect(rules).toContain('Checklist avant validation');
    expect(agents).toContain('docs/VISUAL_SYSTEM.md');
    expect(agents).toContain('préserver toutes les fonctionnalités utiles');
  });

  it('keeps the canonical premium tokens in the shared theme', () => {
    [
      '--tb-canvas', '--tb-surface', '--tb-ink', '--tb-muted', '--tb-coral',
      '--tb-lagoon', '--tb-success', '--tb-warning', '--tb-danger', '--tb-line',
      '--tb-radius-sm', '--tb-radius-md', '--tb-radius-lg', '--tb-shadow',
    ].forEach((token) => expect(theme).toContain(`${token}:`));
    expect(main).toContain("import './ui/premium-theme.css'");
  });

  it('documents the dashboard and responsive invariants', () => {
    expect(rules).toContain('semaine précédente, aujourd’hui et semaine suivante');
    expect(rules).toContain('bouton `↔` et swipe horizontal');
    expect(rules).toContain('total projeté en fin de période');
    expect(rules).toContain('À 390 px');
    expect(theme).toContain('@media (max-width: 600px)');
  });
});
