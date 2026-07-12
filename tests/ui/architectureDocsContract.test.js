import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('architecture documentation contract', () => {
  const doc = fs.readFileSync('docs/V11_ARCHITECTURE.md', 'utf8');
  const checklist = fs.readFileSync('docs/V11_REFACTOR_CHECKLIST.md', 'utf8');

  it('documents the V11 layers, locked domains and migration procedure', () => {
    for (const token of [
      'src/core',
      'src/data',
      'src/features/<domaine>',
      'src/app/bridge.js',
      'public/legacy/js',
      'Domaines verrouilles',
      'Chargement',
      'Procedure de migration',
      'Regles de garde',
    ]) {
      expect(doc).toContain(token);
    }
  });

  it('names every locked domain contract family', () => {
    for (const token of [
      'Nutrition',
      'Travail',
      'Patrimoine',
      'Trip',
      'Sport',
      'tests/ui/*DomainContract.test.js',
      'tests/ui/legacyDomainLoader.test.js',
    ]) {
      expect(doc).toContain(token);
    }
  });

  it('keeps the checklist linked to the architecture documentation work', () => {
    expect(checklist).toContain('Documenter architecture, conventions et procedure de migration.');
  });
});
