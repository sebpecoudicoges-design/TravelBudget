import { it, expect, vi } from 'vitest';
import { createModuleRegistry } from '../../src/app/moduleRegistry.js';

const origin = 'https://app.example';
const source = '/src/features/trip/tripRecapView.js';
const failure = path => new TypeError(`Failed to fetch dynamically imported module: ${origin}${path}`);

it('shares concurrent imports and retains the successful resource across callers', async () => {
  let finish;
  const load = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const registry = createModuleRegistry({ recap: [source, load] }, { origin });
  const first = registry.load('recap');
  expect(registry.load('recap')).toBe(first);
  expect(registry.isLoaded('recap')).toBe(false);
  await Promise.resolve(); finish({ ready: true }); await first;
  expect(await registry.load('recap')).toEqual({ ready: true });
  expect(registry.isLoaded('recap')).toBe(true); expect(load).toHaveBeenCalledTimes(1);
});

it.each([source, '/assets/tripRecapView-build.js'])('recovers an allowed failed entry without invalidating sibling modules: %s', async path => {
  const ready = vi.fn(async () => ({ ready: true }));
  const load = vi.fn().mockRejectedValue(failure(path));
  const retry = vi.fn(async () => ({ recovered: true }));
  const registry = createModuleRegistry({ recap: [source, load], ready: ['/src/features/trip/tripDocumentView.js', ready] }, { origin, importURL: retry });
  await registry.load('ready');
  await expect(registry.load('recap')).rejects.toThrow();
  expect(registry.isLoaded('recap')).toBe(false);
  await Promise.all([registry.load('recap'), registry.load('recap'), registry.load('ready')]);
  expect(retry.mock.calls).toEqual([[`${origin}${path}?tb_import_retry=1`]]);
  expect(ready).toHaveBeenCalledTimes(1); expect(load).toHaveBeenCalledTimes(1);
});

it('refuses another registered entry or dependency named in an import error', async () => {
  const retry = vi.fn();
  const registry = createModuleRegistry({ recap: [source, () => Promise.reject(failure('/assets/tripDocumentView-build.js'))] }, { origin, importURL: retry });
  await expect(registry.load('recap')).rejects.toThrow();
  await expect(registry.load('recap')).rejects.toThrow();
  expect(retry).not.toHaveBeenCalled();
});

it('rejects unknown keys and invalid declarations without calling a module', async () => {
  const load = vi.fn();
  expect(() => createModuleRegistry({ invalid: ['https://other.example/x.js', load] }, { origin })).toThrow('Invalid module');
  await expect(createModuleRegistry({}, { origin }).load('missing')).rejects.toThrow('Unknown module');
  expect(load).not.toHaveBeenCalled();
});
