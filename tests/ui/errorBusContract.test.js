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

  it('never uploads persisted logs that belong to another account', () => {
    expect(source).toContain('const storedRows = _readStored();');
    expect(source).toContain('String(row.user_id) === String(currentUserId)');
    expect(source).toContain('if (rows.length !== storedRows.length) _writeStored(rows);');
    expect(source).toContain('_payload(row, currentUserId)');
  });
});
