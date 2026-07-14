import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  ROOT,
  WARNING,
  collectFeatureMetadata,
  collectInventory,
  currentCommit,
} from './generate-project-atlas.mjs';

const EXPECTED_IDS = [
  'analysis.budget-actual',
  'assets.movement',
  'budget.daily',
  'budget.transaction',
  'nutrition.meal',
  'sport.session',
  'sync.offline',
  'trip.budget-link',
  'wallet.balance',
  'work.income',
].sort();

const errors = [];
const fail = (message) => errors.push(message);
const exists = (relativePath) => fs.existsSync(path.join(ROOT, relativePath));

for (const required of [
  'docs/README.md',
  'docs/PROJECT_ATLAS.md',
  'docs/ARCHITECTURE_DECISIONS.md',
  'docs/generated/project-inventory.md',
  'docs/generated/project-inventory.json',
]) {
  if (!exists(required)) fail(`${required}: fichier requis absent`);
}

const atlasMarkdown = [
  'docs/README.md',
  'docs/PROJECT_ATLAS.md',
  'docs/ARCHITECTURE_DECISIONS.md',
  'docs/generated/project-inventory.md',
  ...fs.existsSync(path.join(ROOT, 'docs', 'features'))
    ? fs.readdirSync(path.join(ROOT, 'docs', 'features')).filter((name) => name.endsWith('.md')).map((name) => `docs/features/${name}`)
    : [],
];
for (const documentPath of atlasMarkdown) {
  if (!exists(documentPath)) continue;
  const source = fs.readFileSync(path.join(ROOT, documentPath), 'utf8');
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, '');
    if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const withoutFragment = target.split('#')[0].split('?')[0];
    if (!withoutFragment) continue;
    const resolved = path.resolve(path.dirname(path.join(ROOT, documentPath)), withoutFragment);
    if (!fs.existsSync(resolved)) fail(`${documentPath}: lien local absent ${target}`);
  }
}

let features = [];
try {
  features = collectFeatureMetadata();
} catch (error) {
  fail(error.message);
}

const ids = features.map((feature) => feature.id);
for (const id of new Set(ids)) {
  if (ids.filter((value) => value === id).length > 1) fail(`ID de fonctionnalité dupliqué: ${id}`);
}
if (JSON.stringify([...ids].sort()) !== JSON.stringify(EXPECTED_IDS)) {
  fail(`Registre critique incorrect. Attendu: ${EXPECTED_IDS.join(', ')}`);
}

for (const feature of features) {
  const label = feature.document || feature.id || 'fiche inconnue';
  if (!feature.id) fail(`${label}: id absent`);
  if (!Array.isArray(feature.dependencies)) fail(`${label}: dependencies doit être un tableau`);
  for (const dependency of feature.dependencies || []) {
    if (!ids.includes(dependency)) fail(`${label}: dépendance inconnue ${dependency}`);
  }
  if (!feature.impacts || typeof feature.impacts !== 'object') fail(`${label}: impacts absents`);
  for (const relativePath of feature.files || []) {
    if (!exists(relativePath)) fail(`${label}: chemin absent ${relativePath}`);
  }
  for (const testPath of feature.tests || []) {
    if (!testPath.startsWith('tests/')) fail(`${label}: test hors de tests/ ${testPath}`);
    if (!exists(testPath)) fail(`${label}: test absent ${testPath}`);
  }
  const validation = feature.validation || {};
  if (!validation.commit || !validation.date || !validation.verifiedBy) {
    fail(`${label}: validation incomplète (commit, date, verifiedBy requis)`);
  } else {
    try {
      execFileSync('git', ['cat-file', '-e', `${validation.commit}^{commit}`], { cwd: ROOT, stdio: 'ignore' });
    } catch {
      fail(`${label}: commit de validation inconnu ${validation.commit}`);
    }
  }
}

if (exists('docs/generated/project-inventory.md')) {
  const markdown = fs.readFileSync(path.join(ROOT, 'docs/generated/project-inventory.md'), 'utf8');
  if (!markdown.startsWith(`> ${WARNING}\n`)) fail('project-inventory.md: avertissement généré absent en première ligne');
}

if (exists('docs/generated/project-inventory.json')) {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/generated/project-inventory.json'), 'utf8'));
    if (saved._generatedWarning !== WARNING) fail('project-inventory.json: avertissement généré absent');
    try {
      execFileSync('git', ['cat-file', '-e', `${saved.commit}^{commit}`], { cwd: ROOT, stdio: 'ignore' });
    } catch {
      fail(`project-inventory.json: commit analysé inconnu ${saved.commit}`);
    }
    const current = collectInventory({ generatedAt: saved.generatedAt });
    const stable = (inventory) => {
      const { commit, generatedAt, ...rest } = inventory;
      return rest;
    };
    if (JSON.stringify(stable(saved)) !== JSON.stringify(stable(current))) fail('project-inventory.json: snapshot différent du dépôt courant; exécuter npm run atlas:generate');
  } catch (error) {
    fail(`project-inventory.json: ${error.message}`);
  }
}

if (errors.length) {
  process.stderr.write(`Contrôle documentaire en échec (${errors.length} erreur(s)):\n- ${errors.join('\n- ')}\n`);
  process.exit(1);
}

process.stdout.write(`Documentation Atlas valide: ${features.length} fiches, commit ${currentCommit().slice(0, 12)}.\n`);
