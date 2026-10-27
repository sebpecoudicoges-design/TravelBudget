import { createRetryableImport, createRetryableLoader } from './retryableLoader.js';

// Entries are declared by the application, never supplied by navigation or server data.
export function createModuleRegistry(entries, { origin, importURL } = {}) {
  const imports = new Map(Object.entries(entries).map(([key, [source, load]]) => {
    const name = source.match(/^\/src\/(?:[\w-]+\/)+([\w-]+)\.js$/)?.[1];
    if (!name || typeof load !== 'function') throw new Error(`Invalid module entry: ${key}`);
    const compiled = new RegExp(`^/assets/${name}-[\\w-]+\\.js$`);
    return [key, createRetryableImport(load, {
      origin, importURL,
      acceptsPath: path => path === source || compiled.test(path),
    })];
  }));
  return createRetryableLoader(key => {
    if (!imports.has(key)) throw new Error(`Unknown module: ${key}`);
    return imports.get(key)();
  });
}
