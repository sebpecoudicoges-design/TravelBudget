// Share concurrent attempts, retain successful resources, and forget failures.
// A resource is loaded only after its entire initialization has resolved.
export function createRetryableLoader(loadResource) {
  const entries = new Map();
  return {
    load(key) {
      if (entries.has(key)) return entries.get(key).promise;
      const entry = { loaded: false };
      entry.promise = Promise.resolve().then(() => loadResource(key)).then(value => {
        entry.loaded = true;
        return value;
      }).catch(error => {
        entries.delete(key);
        throw error;
      });
      entries.set(key, entry);
      return entry.promise;
    },
    isLoaded(key) { return entries.get(key)?.loaded === true; },
  };
}

// Chromium can retain a failed module URL. Only retry a known same-origin
// entrypoint; never bypass evaluation errors or reload successfully evaluated modules.
export function createRetryableImport(importModule, { origin, acceptsPath, importURL = url => import(/* @vite-ignore */ url) }) {
  let failedURL;
  let attempt = 0;
  let evaluationError;
  let loaded;
  return async () => {
    if (loaded) return loaded;
    if (evaluationError) throw evaluationError;
    try {
      if (!failedURL) return (loaded = await importModule());
      const url = new URL(failedURL);
      url.searchParams.set('tb_import_retry', String(++attempt));
      return (loaded = await importURL(url.href));
    } catch (error) {
      const match = String(error?.message || '').match(/^Failed to fetch dynamically imported module: (https?:\/\/\S+)$/);
      if (error?.name === 'TypeError' && match) {
        const url = new URL(match[1]);
        if (url.origin === origin && acceptsPath(url.pathname)) failedURL = url.href;
        else evaluationError = error;
      } else evaluationError = error;
      throw error;
    }
  };
}
