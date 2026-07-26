import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const legacy = () => fs.readFileSync('public/legacy/js/43_documents_ui.js', 'utf8');

function occurrences(source, pattern) {
  return (source.match(pattern) || []).length;
}

describe('documents domain legacy contract', () => {
  it('keeps batch document actions on the current modal flow without duplicate legacy prompts', () => {
    const source = legacy();

    expect(occurrences(source, /async function shareSelected\(/g)).toBe(1);
    expect(occurrences(source, /async function moveSelected\(/g)).toBe(1);
    expect(occurrences(source, /async function addTagSelected\(/g)).toBe(1);

    expect(source).toContain('window.tbDocumentsGenerateShareLinks = generateShareLinksSelected');
    expect(source).toContain('window.tbDocumentsApplyMoveSelected = applyMoveSelected');
    expect(source).toContain('window.tbDocumentsApplyAddTagSelected = applyAddTagSelected');
    expect(source).not.toContain('Durée du lien temporaire ? 10m, 1h ou 24h');
    expect(source).not.toContain('Tag a ajouter aux documents selectionnes ?');
  });
});
