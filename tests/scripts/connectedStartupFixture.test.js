import { describe, it, expect } from 'vitest';
import { fixtureResponse, fixtureUser, projectOrigin, transactionCount } from '../../scripts/fixtures/connectedStartup.mjs';

describe('connected startup synthetic transport', () => {
  it('returns all transactions over two pages without duplicates or omissions', () => {
    const first = fixtureResponse(`${projectOrigin}/rest/v1/transactions?user_id=eq.${fixtureUser}&offset=0&limit=1000`);
    const second = fixtureResponse(`${projectOrigin}/rest/v1/transactions?user_id=eq.${fixtureUser}&offset=1000&limit=1000`);
    expect(first).toHaveLength(1000);
    expect(second).toHaveLength(transactionCount - 1000);
    expect(new Set([...first, ...second].map(row => row.id)).size).toBe(transactionCount);
    expect(fixtureResponse(`${projectOrigin}/rest/v1/transactions?user_id=eq.someone-else`)).toEqual([]);
  });

  it('supports object responses and range headers used by the client', () => {
    expect(fixtureResponse(`${projectOrigin}/rest/v1/profiles`, 'GET', { accept: 'application/vnd.pgrst.object+json' })).toMatchObject({ id: fixtureUser });
    expect(fixtureResponse(`${projectOrigin}/rest/v1/transactions`, 'GET', { range: '1000-1999' })).toHaveLength(200);
  });

  it('returns only requested columns so missing selects cannot pass unnoticed', () => {
    const rows = fixtureResponse(`${projectOrigin}/rest/v1/transactions?select=id,date_start,date_end&limit=1`);
    expect(Object.keys(rows[0]).sort()).toEqual(['date_end', 'date_start', 'id']);
    expect(rows[0].date_start).toBe('2026-10-01');
  });

  it.each([
    ['https://example.com/rest/v1/transactions', 'GET'],
    [`${projectOrigin}/rest/v1/transactions`, 'POST'],
    [`${projectOrigin}/rest/v1/transactions`, 'DELETE'],
    [`${projectOrigin}/rest/v1/unknown_table`, 'GET'],
    [`${projectOrigin}/rest/v1/rpc/unknown_function`, 'POST'],
  ])('rejects unconfigured traffic %s %s', (url, method) => {
    expect(() => fixtureResponse(url, method)).toThrow();
  });
});
