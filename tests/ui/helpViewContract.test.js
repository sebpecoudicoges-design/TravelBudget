import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const help = fs.readFileSync('public/legacy/js/31_help_faq.js', 'utf8');
const theme = fs.readFileSync('src/ui/premium-theme.css', 'utf8');

describe('Help view contract', () => {
  it('keeps quick-start completion manually checkable and collapsible', () => {
    expect(help).toContain('HELP_SETUP_STORAGE_KEY');
    expect(help).toContain('data-help-setup-key');
    expect(help).toContain('data-help-setup-view');
    expect(help).toContain('HELP_SETUP_OPEN_KEY');
    expect(help).toContain('class="tb-help-setup-card"');
    expect(help).not.toContain('onclick="showView');
  });

  it('explains diagnostics and exposes a direct support path', () => {
    expect(help).toContain('Contacter le support');
    expect(help).toContain('seb.pecoud.icoges@gmail.com');
    expect(help).toContain('À quoi sert ce diagnostic ?');
    expect(help).toContain('exporte les logs puis joins-les');
  });

  it('uses premium responsive styles for the treated Help and Documents surfaces', () => {
    expect(theme).toContain('.tb-help-setup-card');
    expect(theme).toContain('.tb-help-diag-help');
    expect(theme).toContain('.tb-doc-sidebar-mark');
    expect(theme).toContain('.tb-doc-folder.active');
    expect(theme).toContain('@media (hover: none), (pointer: coarse)');
  });
});
