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
    expect(dicts.fr['trip.help.settlement']).toMatch(/^Le règlement solde les comptes entre participants\./);
    expect(dicts.fr['trip.help.settlement']).not.toMatch(/[?\uFFFD]/u);
    expect(dicts.fr['help.quick_start.trip']).toBe('Utiliser Partage si tu dépenses à plusieurs');
    expect(dicts.en['documents.sort.name_asc']).toBe('Name A → Z');
    expect(dicts.en['help.quick_start.transactions']).toBe('Enter a first transaction');
  });

  it('keeps non-question UI labels and local assistant lists free of corrupted punctuation', () => {
    const dicts = loadDictionaries();
    const keys = [
      'common.loading', 'tx.help.type', 'tx.help.wallet', 'help.search_placeholder', 'assistant.placeholder',
      'assistant.hint', 'assistant.intent.documents', 'assistant.intent.assets', 'assistant.intent.trip',
      'documents.search.placeholder', 'documents.loading', 'documents.tag.title', 'documents.tag.hint',
      'documents.linked_transactions.search_placeholder', 'documents.linked_transactions.unlinked',
      'assets.card.floor_reached', 'assets.card.ownership_missing', 'assets.owners.total_hint',
      'settings.card.account_summary', 'settings.card.travel_summary', 'settings.card.periods_summary',
      'settings.account.cashflow_reference', 'settings.fx.update_needed', 'settings.fx.empty',
      'trip.history.search_placeholder', 'recurring.help.yearly', 'help.guide.rename_voyage.body',
    ];
    for (const key of keys) {
      for (const lang of ['fr', 'en']) expect(dicts[lang][key], lang + ':' + key).toMatch(/^[^?\uFFFD]+$/u);
      expect(dicts.fr[key].match(/\{\w+\}/g)).toEqual(dicts.en[key].match(/\{\w+\}/g));
    }
    for (const lang of ['fr', 'en']) {
      for (const key of ['assistant.intent.documents', 'assistant.intent.assets', 'assistant.intent.trip']) {
        const steps = dicts[lang][key].split('\n').slice(1);
        expect(steps, lang + ':' + key).toHaveLength(4);
        expect(steps.every(step => step.startsWith('• '))).toBe(true);
      }
      expect(dicts[lang]['fxdecision.rate_override_hint']).toContain('1 {from} = ? {to}');
      expect(dicts[lang]['documents.confirm.delete_selected']).toContain('?');
    }
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
