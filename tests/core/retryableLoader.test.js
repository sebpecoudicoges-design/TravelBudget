import { describe, expect, it, vi } from 'vitest';
import { createRetryableLoader, createRetryableImport } from '../../src/app/retryableLoader.js';

describe('retryable resource loader', () => {
  it('shares in-flight attempts and reports loaded only after success', async () => {
    let finish;
    const load = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const loader = createRetryableLoader(load);
    const first = loader.load('trip');
    expect(loader.load('trip')).toBe(first);
    expect(loader.isLoaded('trip')).toBe(false);
    await Promise.resolve();
    finish(true);
    await first;
    expect(loader.isLoaded('trip')).toBe(true);
    expect(loader.load('trip')).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('retries rejected and synchronously thrown attempts without disturbing other resources', async () => {
    let attempts = 0;
    const loader = createRetryableLoader(key => {
      if (key === 'broken' && ++attempts < 3) {
        if (attempts === 1) throw new Error('offline');
        return Promise.reject(new Error('offline again'));
      }
      return key;
    });
    await loader.load('ready');
    await expect(loader.load('broken')).rejects.toThrow('offline');
    expect(loader.isLoaded('broken')).toBe(false);
    await expect(loader.load('broken')).rejects.toThrow('offline again');
    expect(loader.isLoaded('ready')).toBe(true);
    await expect(loader.load('broken')).resolves.toBe('broken');
    expect(loader.isLoaded('broken')).toBe(true);
  });

  it('resumes a partially loaded domain without executing successful scripts twice', async () => {
    const execute = vi.fn().mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('network')).mockResolvedValue(true);
    const scripts = createRetryableLoader(execute);
    const domains = createRetryableLoader(async () => {
      await scripts.load('first.js');
      await scripts.load('second.js');
      return true;
    });
    await expect(domains.load('work')).rejects.toThrow('network');
    expect(domains.isLoaded('work')).toBe(false);
    await Promise.all([domains.load('work'), domains.load('work')]);
    expect(execute.mock.calls.map(([src]) => src)).toEqual(['first.js', 'second.js', 'second.js']);
    expect(domains.isLoaded('work')).toBe(true);
  });
});

describe('retryable module import', () => {
  const origin = 'https://app.example';
  const path = '/assets/analysisRuntime-test.js';
  const failure = url => new TypeError(`Failed to fetch dynamically imported module: ${url}`);
  it('retries the allowed failed entrypoint using a new URL after each network failure', async () => {
    const original = vi.fn().mockRejectedValue(failure(origin + path));
    const retry = vi.fn().mockRejectedValueOnce(failure(origin + path + '?tb_import_retry=1')).mockResolvedValue({ ready: true });
    const load = createRetryableImport(original, { origin, acceptsPath: p => p === path, importURL: retry });
    await expect(load()).rejects.toThrow('Failed to fetch');
    await expect(load()).rejects.toThrow('Failed to fetch');
    await expect(load()).resolves.toEqual({ ready: true });
    await expect(load()).resolves.toEqual({ ready: true });
    expect(original).toHaveBeenCalledTimes(1);
    expect(retry.mock.calls.map(([url]) => url)).toEqual([origin + path + '?tb_import_retry=1', origin + path + '?tb_import_retry=2']);
  });
  it.each(['https://other.example/assets/analysisRuntime-test.js', origin + '/unrelated.js'])('does not import an unapproved URL: %s', async url => {
    const retry = vi.fn();
    const load = createRetryableImport(() => Promise.reject(failure(url)), { origin, acceptsPath: p => p === path, importURL: retry });
    await expect(load()).rejects.toThrow();
    await expect(load()).rejects.toThrow();
    expect(retry).not.toHaveBeenCalled();
  });
  it('never re-evaluates a module whose execution fails after a network retry', async () => {
    const retry = vi.fn().mockRejectedValue(new Error('initialization failed'));
    const load = createRetryableImport(() => Promise.reject(failure(origin + path)), { origin, acceptsPath: p => p === path, importURL: retry });
    await expect(load()).rejects.toThrow('Failed to fetch');
    await expect(load()).rejects.toThrow('initialization failed');
    await expect(load()).rejects.toThrow('initialization failed');
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
