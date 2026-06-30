import { describe, expect, it, vi } from 'vitest';
import { createEntityStore } from '../../src/data/entityStore.js';

describe('entity store', () => {
  it('updates state and notifies subscribers', () => {
    const store = createEntityStore({ queue: [] });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set('queue', [{ id: '1' }]);
    expect(store.get('queue')).toEqual([{ id: '1' }]);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ queue: [{ id: '1' }] }), 'queue');
    unsubscribe();
  });
});

