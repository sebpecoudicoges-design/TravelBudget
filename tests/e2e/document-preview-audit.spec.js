import { test, expect } from '@playwright/test';
import { fixtureTables, fixtureUser, installConnectedFixture, projectOrigin } from '../../scripts/fixtures/connectedStartup.mjs';

test.use({ serviceWorkers: 'block', timezoneId: 'UTC', locale: 'fr-FR' });

const bucket = 'personal-documents';
const token = 'fixture-only';
const receipt = {
  id: 'synthetic-receipt', user_id: fixtureUser, name: 'Reçu fictif',
  original_filename: 'recu.png', mime_type: 'image/png', size_bytes: 68,
  storage_bucket: bucket, storage_path: fixtureUser + '/recu.png',
  created_at: '2026-10-21T12:00:00Z',
};
const pdf = {
  ...receipt, id: 'synthetic-pdf', name: 'Itinéraire fictif',
  original_filename: 'itineraire.pdf', mime_type: 'application/pdf',
  storage_path: fixtureUser + '/itineraire.pdf',
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXkQAAAAASUVORK5CYII=', 'base64');

// A real, one-page PDF with only synthetic text. No scripts or external resources.
function fixturePdf() {
  const drawing = 'BT /F1 20 Tf 30 90 Td (TravelBudget - itineraire fictif) Tj ET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 140] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${drawing.length} >>\nstream\n${drawing}endstream`,
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'ascii');
}

const signPath = doc => '/storage/v1/object/sign/' + bucket + '/' + doc.storage_path;
const signedPath = doc => signPath(doc) + '?token=' + token;

for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
  test(`document list → image preview → PDF fallback (${width}px, ${theme})`, async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    const tables = {
      ...fixtureTables, transactions: fixtureTables.transactions.slice(0, 1),
      profiles: [{ ...fixtureTables.profiles[0], role: 'test' }],
      settings: fixtureTables.settings.map(setting => ({ ...setting, theme })),
      documents: [receipt, pdf], document_folders: [], transaction_documents: [],
      trip_expense_documents: [], asset_documents: [],
    };
    await installConnectedFixture(page, baseURL, { tables });
    // Page-level routes do not see the first request of an opened tab.
    // Allow exactly the synthetic PDF there, and never contact live storage.
    let fallbackNavigations = 0;
    await context.route('**/*', async route => {
      const request = route.request();
      if (request.method() !== 'GET' || !request.isNavigationRequest()
        || request.url() !== projectOrigin + signedPath(pdf)) return route.abort();
      await route.fulfill({ contentType: 'application/pdf', body: fixturePdf() });
      fallbackNavigations += 1;
    });
    const signedRequests = [];
    const imageLoads = [];
    await page.route(projectOrigin + '/storage/v1/object/sign/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const doc = [receipt, pdf].find(d => signPath(d) === url.pathname);
      if (!doc) return route.abort();
      if (request.method() === 'POST' && !url.search) {
        signedRequests.push({ id: doc.id, expiresIn: request.postDataJSON().expiresIn });
        return route.fulfill({ json: { signedURL: signedPath(doc).replace('/storage/v1', '') } });
      }
      if (request.method() === 'GET' && url.search === '?token=' + token) {
        if (doc === receipt) {
          imageLoads.push(doc.id);
          return route.fulfill({ contentType: 'image/png', body: png });
        }
        // The embedded PDF viewer is outside this browser contract. Its fallback target is asserted below.
        return route.fulfill({ status: 204 });
      }
      return route.abort();
    });
    await page.addInitScript(user => localStorage.setItem('travelbudget_guided_tour_done_v2_' + user, '1'), fixtureUser);
    await page.goto('/?freeze=1');
    await expect(page.locator('#app-root')).toBeVisible();
    const menu = page.locator('#tb-mobile-nav-toggle');
    if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
    await page.locator('#tab-documents').click();
    await expect(page.locator('#view-documents')).toBeVisible();

    const card = title => page.locator('.tb-doc-card').filter({ hasText: title });
    const open = title => card(title).locator('button[onclick*="tbDocumentsPreview"]').click();
    const preview = page.locator('.tb-doc-preview');
    await open(receipt.name);
    const image = preview.getByRole('img', { name: receipt.name });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(el => el.naturalWidth)).toBe(1);
    expect(imageLoads).toContain(receipt.id);
    await preview.locator('button').click();
    await expect(preview).toHaveCount(0);

    await open(pdf.name);
    await expect(preview.locator('iframe')).toHaveAttribute('src', projectOrigin + signedPath(pdf));
    const fallback = preview.getByRole('link');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('target', '_blank');
    await expect(fallback).toHaveAttribute('href', projectOrigin + signedPath(pdf));
    expect(fallbackNavigations).toBe(0);
    await fallback.click();
    await expect.poll(() => fallbackNavigations).toBe(1);
    await expect(preview).toBeVisible();
    // Thumbnail rendering can sign the image again; only the PDF has no thumbnail.
    expect(signedRequests).toContainEqual({ id: receipt.id, expiresIn: 600 });
    expect(signedRequests.filter(entry => entry.id === pdf.id)).toEqual([{ id: pdf.id, expiresIn: 600 }]);
    expect(signedRequests.every(entry => entry.expiresIn === 600)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
