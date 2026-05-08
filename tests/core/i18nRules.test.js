import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

function loadDictionaries() {
  const code = fs.readFileSync('public/legacy/js/00_i18n.js', 'utf8');
  const sandbox = {
    window: {},
    document: {
      querySelectorAll: () => [],
      getElementById: () => null,
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.window.localStorage = sandbox.localStorage;
  vm.runInNewContext(code, sandbox);
  return sandbox.window.TB_I18N;
}

describe('i18n dictionaries', () => {
  it('keeps French and English keys in sync', () => {
    const dicts = loadDictionaries();
    const fr = Object.keys(dicts.fr).sort();
    const en = Object.keys(dicts.en).sort();

    expect(en).toEqual(fr);
  });

  it('contains the document module UI keys', () => {
    const dicts = loadDictionaries();

    expect(dicts.fr['documents.action.share']).toBeTruthy();
    expect(dicts.en['documents.action.share']).toBeTruthy();
    expect(dicts.fr['documents.share.duration']).toBeTruthy();
    expect(dicts.en['documents.share.duration']).toBeTruthy();
  });
});
