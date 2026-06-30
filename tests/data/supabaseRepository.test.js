import { describe, expect, it, vi } from 'vitest';
import { createSupabaseRepository } from '../../src/data/supabaseRepository.js';

describe('supabase repository', () => {
  it('unwraps successful RPC data and throws Supabase errors', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { id: '1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('denied') });
    const repository = createSupabaseRepository({ from: vi.fn(), rpc });
    await expect(repository.rpc('save', { id: '1' })).resolves.toEqual({ id: '1' });
    await expect(repository.rpc('save', {})).rejects.toThrow('denied');
  });
});

