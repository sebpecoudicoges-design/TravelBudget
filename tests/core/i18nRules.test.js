import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

function loadDictionaries() {
  const code = fs.readFileSync('public/legacy/js/00_i18n.js', 'utf8');
  const enCode = fs.readFileSync('public/legacy/js/00_i18n_en.js', 'utf8');
  const sandbox = {
    window: {},
    document: {
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => ({ set src(value) { this._src = value; }, get src() { return this._src; } }),
      head: { appendChild: () => {} },
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
  vm.runInNewContext(enCode, sandbox);
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

  it('contains transaction bulk safety messages', () => {
    const dicts = loadDictionaries();

    expect(dicts.fr['transactions.bulk.error.locked']).toContain('{count}');
    expect(dicts.en['transactions.bulk.error.locked']).toContain('{count}');
    expect(dicts.fr['transactions.bulk.error.none']).toBeTruthy();
    expect(dicts.en['transactions.bulk.error.none']).toBeTruthy();
  });

  it('keeps treated French labels free of broken replacement characters', () => {
    const dicts = loadDictionaries();

    expect(dicts.fr['documents.folder.unclassified']).toBe('Non classé');
    expect(dicts.fr['documents.sort.name_asc']).toBe('Nom A → Z');
    expect(dicts.fr['settings.account.mode.advanced']).toBe('Avancé');
    expect(dicts.fr['trip.history.search_placeholder']).toBe('Libellé, montant, participant…');
    expect(dicts.en['documents.sort.name_asc']).toBe('Name A → Z');
  });

  it('keeps the English dictionary outside the boot i18n file', () => {
    const boot = fs.readFileSync('public/legacy/js/00_i18n.js', 'utf8');
    const english = fs.readFileSync('public/legacy/js/00_i18n_en.js', 'utf8');

    expect(boot).not.toContain('    en: {');
    expect(boot).toContain('legacy/js/00_i18n_en.js');
    expect(english).toContain("window.tbRegisterI18nDict('en', dict)");
    expect(english).toContain('"app.lang": "Language"');
  });
});
