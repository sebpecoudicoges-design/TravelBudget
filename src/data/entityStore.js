export function createEntityStore(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();

  function notify(key) {
    const snapshot = getSnapshot();
    listeners.forEach((listener) => listener(snapshot, key));
  }

  function getSnapshot() {
    return { ...state };
  }

  return {
    get(key, fallback = undefined) {
      return Object.prototype.hasOwnProperty.call(state, key) ? state[key] : fallback;
    },
    set(key, value) {
      if (Object.is(state[key], value)) return value;
      state = { ...state, [key]: value };
      notify(key);
      return value;
    },
    update(key, updater) {
      if (typeof updater !== 'function') throw new TypeError('Store updater must be a function.');
      return this.set(key, updater(this.get(key)));
    },
    remove(key) {
      if (!Object.prototype.hasOwnProperty.call(state, key)) return false;
      const next = { ...state };
      delete next[key];
      state = next;
      notify(key);
      return true;
    },
    snapshot: getSnapshot,
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Store listener must be a function.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

