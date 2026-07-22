import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Inbox domain contract', () => {
  const main = fs.readFileSync('src/main.js', 'utf8');
  const legacy = fs.readFileSync('public/legacy/js/44_inbox_ui.js', 'utf8');
  const view = fs.readFileSync('src/features/inbox/inboxView.js', 'utf8');

  it('loads the Inbox view module with the Inbox legacy domain', () => {
    expect(main).toContain("if (key === 'inbox')");
    expect(main).toContain("import('./features/inbox/inboxView.js')");
    expect(main).toContain('window.UI.inboxView');
  });

  it('delegates Inbox cards, previews and shell rendering to the view module', () => {
    for (const token of ['renderInboxPreview', 'renderInboxCard', 'renderInboxShell', 'notificationCenterStyles', 'renderNotificationCenterHost', 'renderNotificationCenterPanel']) {
      expect(view).toContain(`export function ${token}`);
      expect(legacy).toContain(`inboxView?.${token}`);
    }
    expect(legacy).toContain('function inboxViewApi()');
    expect(legacy).not.toContain('items.map(renderCard).join');
    expect(legacy).not.toContain('Messages WhatsApp, reçus, photos et PDF à classer plus tard.');
    expect(legacy).not.toContain('function renderCard(item){\n    if(isTripPayerApproval(item)){');
    expect(legacy).not.toContain('#tb-notification-center{position:fixed;right:16px;top:82px;');
    expect(legacy).not.toContain('tb-notification-row" type="button" data-notification-idx="${idx}"');
  });
});
