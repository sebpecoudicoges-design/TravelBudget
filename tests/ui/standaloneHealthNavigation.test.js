import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');

describe('Standalone Health navigation', () => {
  it('keeps Health integrated instead of exposing a separate view', () => {
    const navigation = read('public/legacy/js/10_navigation.js');
    const nutrition = read('public/legacy/js/48_nutrition_ui.js');
    const notifications = read('public/legacy/js/49_notifications_ui.js');

    expect(navigation).not.toContain('"tab-health"');
    expect(navigation).not.toContain('"view-health"');
    expect(nutrition).not.toContain('tab.id = "tab-health"');
    expect(nutrition).not.toContain('view.id = "view-health"');
    expect(nutrition).not.toContain('id="health-root"');
    expect(notifications).not.toContain('getElementById("tab-health")');
    expect(navigation).toContain('if (view === "health") view = "nutrition";');
    expect(nutrition).toContain('window.renderHealth = renderHealth;');
  });
});
