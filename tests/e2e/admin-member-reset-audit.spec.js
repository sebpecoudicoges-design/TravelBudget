import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const memberScript = fileURLToPath(new URL('../../public/legacy/js/30_members_admin.js', import.meta.url));
const origin = 'http://member-reset-fixture.invalid';
const member = '80000000-0000-4000-8000-000000000001';
const other = '80000000-0000-4000-8000-000000000002';
const members = [{ id: member, email: 'member@example.test' }, { id: other, email: 'other@example.test' }];

for (const [lang, width, button, warning] of [
  ['fr', 1440, 'Vider compte', /réinitialisation non confirmée.*ne relancez pas/i],
  ['en', 390, 'Reset account', /reset not confirmed.*do not retry/i],
]) {
  test(`Members shows the uncertain reset on the affected account (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const unexpected = [];
    const sent = [];
    let reads = 0;
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === origin && url.pathname === '/') {
        return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="${lang}"><body><main id="view-members"></main></body></html>` });
      }
      if (url.origin === origin && url.pathname === '/functions/v1/admin-list-users') {
        reads += 1;
        return route.fulfill({ json: { users: members } });
      }
      if (url.origin === origin && url.pathname === '/functions/v1/admin-wipe-user') {
        sent.push(request.postDataJSON());
        return route.fulfill({ status: 500, json: { error: 'FIXTURE_RAW_ERROR_NOT_FOR_UI' } });
      }
      unexpected.push(request.url());
      return route.abort();
    });
    await page.goto(origin);
    await page.evaluate(origin => {
      window.sb = {
        supabaseUrl: origin,
        supabaseKey: 'fixture',
        auth: {
          getUser: async () => ({ data: { user: { id: 'fixture-admin' } } }),
          getSession: async () => ({ data: { session: { access_token: 'fixture' } } }),
        },
      };
    }, origin);
    await page.addScriptTag({ path: memberScript });
    await page.evaluate(() => window._ensureMembersAdminDOM());
    await page.getByRole('button', { name: 'Refresh', exact: true }).first().click();
    const buttons = page.getByRole('button', { name: button, exact: true });
    const target = buttons.nth(0);
    const unrelated = buttons.nth(1);
    await expect(target).toBeEnabled();
    const dialogs = [];
    page.on('dialog', async dialog => {
      dialogs.push([dialog.type(), dialog.message()]);
      await dialog.accept(dialog.type() === 'prompt' ? 'WIPE' : undefined);
    });
    await target.click();
    await expect(target).toBeDisabled();
    await expect(target).toHaveAccessibleDescription(warning);
    await expect(unrelated).toBeEnabled();
    expect(dialogs.map(([kind]) => kind)).toEqual(['prompt', 'alert']);
    expect(dialogs[1][1]).toMatch(warning);
    expect(dialogs[1][1]).not.toContain('FIXTURE_RAW_ERROR_NOT_FOR_UI');
    await page.getByRole('button', { name: 'Refresh', exact: true }).first().click();
    await expect.poll(() => reads).toEqual(2);
    await expect(target).toBeDisabled();
    await expect(target).toHaveAccessibleDescription(warning);
    expect(sent).toEqual([{ targetUserId: member, mode: 'all', confirm: 'WIPE' }]);
    expect(unexpected).toEqual([]);
  });
}
