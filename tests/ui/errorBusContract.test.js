import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../public/legacy/js/98_error_bus.js', import.meta.url), 'utf8');

describe('error bus sync contract', () => {
  it('retries persisted logs idempotently after a network interruption', () => {
    expect(source).toContain('.upsert(payload, { onConflict: "id", ignoreDuplicates: true })');
    expect(source).not.toContain('.from("app_error_logs").insert(payload)');
  });
});
