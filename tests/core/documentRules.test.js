import { describe, expect, it } from 'vitest';
import {
  allDocumentTags,
  canCreateSubFolder,
  childFolders,
  folderLabel,
  mergeTags,
  rootFolders,
  suggestTagsForDocument,
} from '../../src/core/documentRules.js';

describe('document rules core', () => {
  it('suggests payroll, existing employer tag and extracted employer', () => {
    const doc = {
      name: "PECOUD-BOUVET Sebastien Bulletin de Paie Mais 2023 O'TOP ACCESS",
      original_filename: "PECOUD-BOUVET Sebastien Bulletin de Paie Mais 2023 O'TOP ACCESS.pdf",
      mime_type: 'application/pdf',
      tags: [],
    };

    expect(suggestTagsForDocument(doc, { knownTags: ["O'TOP ACCESS"] })).toEqual(
      expect.arrayContaining(['Bulletin de Paie', "O'TOP ACCESS"]),
    );
    expect(suggestTagsForDocument(doc, { knownTags: ["O'TOP ACCESS"] })).not.toContain("Mais O'TOP ACCESS");
    expect(suggestTagsForDocument(doc, { knownTags: ["O'TOP ACCESS"] })).not.toContain('PDF');
  });

  it('matches existing tags only when the whole tag is present', () => {
    const doc = { name: "Bulletin O'TOP", tags: [] };
    const suggestions = suggestTagsForDocument(doc, { knownTags: ["O'TOP", "O'TOP ACCESS"] });

    expect(suggestions).toContain("O'TOP");
    expect(suggestions).not.toContain("O'TOP ACCESS");
  });

  it('suggests contract and STC business tags', () => {
    expect(suggestTagsForDocument({ name: 'Contrat CDI OTOP', tags: [] })).toContain('Contrat');
    expect(suggestTagsForDocument({ name: 'Solde de tout compte OTOP', tags: [] })).toContain('STC');
  });

  it('merges tags without duplicates for batch updates', () => {
    expect(mergeTags(['Banque', 'Contrat'], ['contrat', 'O TOP'])).toEqual(['Banque', 'Contrat', 'O TOP']);
  });

  it('collects unique document tags', () => {
    expect(allDocumentTags([
      { tags: ['Banque', 'O TOP'] },
      { tags: ['banque', "O'TOP ACCESS"] },
    ])).toEqual(['Banque', 'O TOP', "O'TOP ACCESS"]);
  });

  it('handles one-level folder hierarchy', () => {
    const folders = [
      { id: 'parent', name: 'Travail' },
      { id: 'child', name: 'Paie', parent_id: 'parent' },
    ];

    expect(rootFolders(folders).map((f) => f.id)).toEqual(['parent']);
    expect(childFolders(folders, 'parent').map((f) => f.id)).toEqual(['child']);
    expect(folderLabel(folders[1], folders)).toBe('Travail / Paie');
    expect(canCreateSubFolder('parent', folders).ok).toBe(true);
    expect(canCreateSubFolder('child', folders).ok).toBe(false);
  });
});
