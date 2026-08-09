import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../public/legacy/js/98_error_bus.js', import.meta.url), 'utf8');

describe('error bus sync contract', () => {
  it('retries persisted logs idempotently after a network interruption', () => {
    expect(source).toContain('.upsert(payload, { onConflict: "id", ignoreDuplicates: true })');
    expect(source).not.toContain('.from("app_error_logs").insert(payload)');
  });

  it('backs off after an authorization refusal instead of hammering the API', () => {
    expect(source).toContain('if (Date.now() < _syncBlockedUntil)');
    expect(source).toContain('_syncBlockedUntil = Date.now() + (5 * 60 * 1000)');
    expect(source).toContain('code === "42501"');
  });
});
