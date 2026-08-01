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
    expect(source).toContain("docView('renderDocumentTransactionsModal'");
    expect(source).toContain("docView('renderDocumentAssetsModal'");
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
    expect(source).toContain("docView('renderDocumentFolders'");
    expect(source).toContain("docView('renderDocumentMain'");
    expect(source).toContain("docView('renderDocumentShell'");
    expect(source).not.toContain('<div class="tb-doc-sidebar-head">');
    expect(source).not.toContain('<div class="tb-doc-sidebar"><strong>');
    expect(source).not.toContain('<div class="tb-doc-dropzone"');
    expect(source).not.toContain('<div class="tb-doc-main"><div class="tb-doc-grid">');
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
    expect(source).toContain("docView('renderDocumentShareModal'");
    expect(source).toContain("docView('renderDocumentShareResultModal'");
    expect(source).toContain("docView('renderDocumentMoveSelectedModal'");
    expect(source).toContain("docView('renderDocumentAddTagSelectedModal'");
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
    expect(source).not.toContain('<select id="tb-doc-batch-folder"');
    expect(source).not.toContain('<input id="tb-doc-batch-tag"');
  });

  it('delegates preview and metadata modals to documentView', () => {
    const source = legacy();
    const view = fs.readFileSync('src/features/documents/documentView.js', 'utf8');

    expect(view).toContain('export function renderDocumentPreviewModal');
    expect(view).toContain('export function renderDocumentInfoModal');
    expect(source).toContain("docView('renderDocumentPreviewModal'");
    expect(source).toContain("docView('renderDocumentInfoModal'");
    expect(source).not.toContain('<div class="tb-doc-preview"><div class="tb-doc-preview-head">');
    expect(source).not.toContain('<div class="tb-doc-preview"><div class="tb-doc-preview-body">');
    expect(source).not.toContain('<div class="tb-doc-modal"><h3>');
    expect(source).not.toContain('<input id="tb-doc-info-tags"');
    expect(source).not.toContain('<textarea id="tb-doc-info-notes"');
  });
});
