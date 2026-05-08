import { describe, expect, it } from 'vitest';
import {
  allDocumentTags,
  canCreateSubFolder,
  childFolders,
  filterVisibleDocuments,
  folderLabel,
  mergeTags,
  normalizeCollapsedFolderIds,
  rootFolders,
  selectVisibleDocumentIds,
  shareDurationSeconds,
  suggestTagsForDocument,
  toggleCollapsedFolderId,
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

  it('filters visible documents by folder, search, tag and favorite state', () => {
    const documents = [
      { id: '1', folder_id: 'work', name: 'Bulletin avril', tags: ['Paie'], is_favorite: true },
      { id: '2', folder_id: 'work', name: 'Contrat CDI', tags: ['Contrat'], is_favorite: false },
      { id: '3', folder_id: 'travel', name: 'Passeport', tags: ['Identite'], is_favorite: true },
    ];

    expect(filterVisibleDocuments(documents, {
      selectedFolderId: 'work',
      search: 'bulletin',
      tagFilter: 'paie',
      onlyFavorites: true,
    }).map((doc) => doc.id)).toEqual(['1']);
  });

  it('filters expiring documents over the next sixty days', () => {
    const documents = [
      { id: 'soon', expires_at: '2026-06-01' },
      { id: 'late', expires_at: '2026-09-01' },
      { id: 'none' },
    ];

    expect(filterVisibleDocuments(documents, {
      onlyExpiring: true,
      now: '2026-05-08',
    }).map((doc) => doc.id)).toEqual(['soon']);
  });

  it('selects all visible document ids without losing existing selection', () => {
    expect(selectVisibleDocumentIds(['already'], [
      { id: 'visible-1' },
      { id: 'visible-2' },
      { id: 'visible-1' },
    ])).toEqual(['already', 'visible-1', 'visible-2']);
  });

  it('normalizes and toggles collapsed folders', () => {
    expect(normalizeCollapsedFolderIds(['parent', 'parent', '', null])).toEqual(['parent']);
    expect(toggleCollapsedFolderId(['parent'], 'parent')).toEqual([]);
    expect(toggleCollapsedFolderId([], 'parent')).toEqual(['parent']);
  });

  it('maps document share durations to signed url lifetimes', () => {
    expect(shareDurationSeconds('10m')).toBe(600);
    expect(shareDurationSeconds('1h')).toBe(3600);
    expect(shareDurationSeconds('24h')).toBe(86400);
    expect(shareDurationSeconds('unknown')).toBe(3600);
  });
});
