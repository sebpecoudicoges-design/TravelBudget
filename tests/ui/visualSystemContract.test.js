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

  it('keeps wallet archive actions inside the wallet action column', () => {
    const archiveRule = theme.match(/body:not\(\.theme-dark\) \.tb-wallet-archive-btn \{[\s\S]*?\n\}/)?.[0] || '';
    expect(archiveRule).toContain('border-style: dashed');
    expect(archiveRule).not.toContain('margin-top: auto');
  });

  it('keeps the desktop admin rail in one vertical column', () => {
    expect(theme).toContain('flex-wrap: nowrap !important');
    expect(theme).toContain('max-height: calc(100vh - 108px)');
    expect(theme).toContain('min-height: 30px');
  });

  it('renders subscription insights as compact rows on desktop', () => {
    expect(theme).toContain('.tb-subscription-spotlights__grid{display:grid;grid-template-columns:1fr;gap:9px}');
    expect(theme).toContain('.tb-subscriptions-toolbar nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible;width:100%}');
    expect(theme).toContain('.tb-subscription-association');
    expect(theme).toContain('.tb-subscription-detail__metrics');
    expect(theme).toContain('grid-template-columns:minmax(180px,1fr) minmax(150px,.72fr) minmax(260px,1.15fr)');
    expect(theme).toContain('padding:10px 13px');
  });

  it('keeps the subscription cash summary inside each flow card', () => {
    expect(theme).toContain('.tb-subscription-flow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))');
    expect(theme).toContain('.tb-subscription-flow__title{grid-column:1/-1');
    expect(theme).toContain('.tb-subscription-flow__amounts span{min-width:0;white-space:nowrap}');
    expect(theme).toContain('.tb-subscription-flow>div:nth-child(4){grid-column:1/-1');
    expect(theme).not.toContain('minmax(110px,1fr) repeat(3,minmax(92px,.8fr))');
  });
});
