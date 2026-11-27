// Generate a tiny, self-contained test site for the audit-only Capacitor APK.
// It contains no production script, account, URL or document.
import assert from 'node:assert/strict';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [rendererFile, outputDir] = process.argv.slice(2);
assert(rendererFile && outputDir, 'Usage: node pdf_preview_fixture.mjs renderer-file empty-web-dir');
const { renderDocumentPreviewModal } = await import(pathToFileURL(path.resolve(rendererFile)).href);
await mkdir(outputDir, { recursive: true });
assert.deepEqual(await readdir(outputDir), [], 'Use an empty Capacitor web directory');

const drawing = '0.94 0.22 0.16 rg 10 10 340 120 re f\n1 1 1 rg BT /F1 18 Tf 30 74 Td (TravelBudget - synthetic PDF) Tj ET\n';
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 140] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${drawing.length} >>\nstream\n${drawing}endstream`,
];
let pdf = '%PDF-1.4\n';
const offsets = objects.map((object, index) => {
  const offset = pdf.length;
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  return offset;
});
const xref = pdf.length;
pdf += `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
pdf += `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

const labels = {
  'documents.action.new_tab': 'Open in new tab',
  'documents.action.close': 'Close preview',
};
const url = '/audit-document.pdf';
const modal = renderDocumentPreviewModal({
  name: 'Synthetic itinerary',
  url,
  body: `<iframe src="${url}" title="Synthetic PDF preview"></iframe>`,
  tr: key => labels[key],
});
assert(modal.includes(`href="${url}" target="_blank" rel="noopener"`));
assert(modal.includes(`<iframe src="${url}"`));
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>TravelBudget PDF audit</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src 'self'; form-action 'none'; connect-src 'none'">
<style>
body { margin: 24px 12px; font: 16px system-ui; color: #111; background: #eef3f3; }
.tb-doc-preview { padding: 12px; background: white; border: 1px solid #234; }
.tb-doc-preview-head { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding-bottom: 12px; }
.btn { padding: 8px; color: #123; }
iframe { width: 100%; height: 240px; box-sizing: border-box; border: 2px solid #246; background: white; }
</style></head><body>
<h1>TravelBudget PDF audit</h1>
<div class="tb-doc-preview-backdrop">${modal}</div>
</body></html>`;
await writeFile(path.join(outputDir, 'index.html'), html, { flag: 'wx' });
await writeFile(path.join(outputDir, 'audit-document.pdf'), pdf, { encoding: 'ascii', flag: 'wx' });
