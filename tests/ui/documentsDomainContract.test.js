import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const legacy = () => fs.readFileSync('public/legacy/js/43_documents_ui.js', 'utf8');

function occurrences(source, pattern) {
  return (source.match(pattern) || []).length;
}

describe('documents domain legacy contract', () => {
  it('delegates linked transaction, Trip and asset modals to documentView', () => {
    const source = legacy();
    const view = fs.readFileSync('src/features/documents/documentView.js', 'utf8');

    expect(view).toContain('export function renderDocumentTransactionsModal');
    expect(view).toContain('export function renderDocumentAssetsModal');
    expect(source).toContain('window.UI?.documentView?.renderDocumentTransactionsModal');
    expect(source).toContain('window.UI?.documentView?.renderDocumentAssetsModal');
    expect(source).not.toContain('<strong>Dépenses Trip liées</strong>');
    expect(source).not.toContain('candidates.length ? candidates.map(tx =>');
    expect(source).not.toContain('candidates.length ? candidates.map(a =>');
  });

  it('delegates folder navigation, main area and shell to documentView', () => {
    const source = legacy();
    const view = fs.readFileSync('src/features/documents/documentView.js', 'utf8');

    expect(view).toContain('export function renderDocumentFolders');
    expect(view).toContain('export function renderDocumentMain');
    expect(view).toContain('export function renderDocumentShell');
    expect(source).toContain('window.UI?.documentView?.renderDocumentFolders');
    expect(source).toContain('window.UI?.documentView?.renderDocumentMain');
    expect(source).toContain('window.UI?.documentView?.renderDocumentShell');
    expect(source).not.toContain('<div class="tb-doc-sidebar-head">');
    expect(source).not.toContain('<div class="tb-doc-dropzone"');
    expect(source).not.toContain('<div class="tb-doc-hero">');
    expect(source).not.toContain('window.tbDocumentsRenderOnly');
  });

  it('keeps batch document actions on the current modal flow without duplicate legacy prompts', () => {
    const source = legacy();
    const view = fs.readFileSync('src/features/documents/documentView.js', 'utf8');

    expect(view).toContain('export function renderDocumentShareModal');
    expect(view).toContain('export function renderDocumentShareResultModal');
    expect(view).toContain('export function renderDocumentMoveSelectedModal');
    expect(view).toContain('export function renderDocumentAddTagSelectedModal');
    expect(source).toContain('window.UI?.documentView?.renderDocumentShareModal');
    expect(source).toContain('window.UI?.documentView?.renderDocumentShareResultModal');
    expect(source).toContain('window.UI?.documentView?.renderDocumentMoveSelectedModal');
    expect(source).toContain('window.UI?.documentView?.renderDocumentAddTagSelectedModal');
    expect(occurrences(source, /async function shareSelected\(/g)).toBe(1);
    expect(occurrences(source, /async function moveSelected\(/g)).toBe(1);
    expect(occurrences(source, /async function addTagSelected\(/g)).toBe(1);

    expect(source).toContain('window.tbDocumentsGenerateShareLinks = generateShareLinksSelected');
    expect(source).toContain('window.tbDocumentsApplyMoveSelected = applyMoveSelected');
    expect(source).toContain('window.tbDocumentsApplyAddTagSelected = applyAddTagSelected');
    expect(source).not.toContain('Durée du lien temporaire ? 10m, 1h ou 24h');
    expect(source).not.toContain('Tag a ajouter aux documents selectionnes ?');
    expect(source).not.toContain('<label for="tb-doc-share-duration">');
    expect(source).not.toContain('<label for="tb-doc-batch-folder">');
    expect(source).not.toContain('<label for="tb-doc-batch-tag">');
  });

  it('delegates preview and metadata modals to documentView', () => {
    const source = legacy();
    const view = fs.readFileSync('src/features/documents/documentView.js', 'utf8');

    expect(view).toContain('export function renderDocumentPreviewModal');
    expect(view).toContain('export function renderDocumentInfoModal');
    expect(source).toContain('window.UI?.documentView?.renderDocumentPreviewModal');
    expect(source).toContain('window.UI?.documentView?.renderDocumentInfoModal');
    expect(source).not.toContain('<div class="tb-doc-preview"><div class="tb-doc-preview-head">');
    expect(source).not.toContain('<input id="tb-doc-info-tags"');
    expect(source).not.toContain('<textarea id="tb-doc-info-notes"');
  });
});
