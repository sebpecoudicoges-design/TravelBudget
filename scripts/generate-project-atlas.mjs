import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(SCRIPT_DIR, '..');
export const GENERATED_DIR = path.join(ROOT, 'docs', 'generated');
export const FEATURE_DIR = path.join(ROOT, 'docs', 'features');
export const PUBLIC_ATLAS_PATH = path.join(ROOT, 'public', 'project-atlas.json');
export const WARNING = 'Fichier généré automatiquement. Ne pas modifier manuellement.';

function posix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function listFiles(relativeDir, predicate = () => true) {
  const absoluteDir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  const found = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else {
        const relative = posix(path.relative(ROOT, absolute));
        if (predicate(relative)) found.push(relative);
      }
    }
  };
  visit(absoluteDir);
  return found.sort();
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

export function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'git-indisponible';
  }
}

export function parseFeatureDocument(source, relativePath) {
  const match = source.match(/<!--\s*atlas-meta\s*([\s\S]*?)-->/);
  if (!match) throw new Error(`${relativePath}: bloc atlas-meta absent`);
  let metadata;
  try {
    metadata = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`${relativePath}: atlas-meta JSON invalide (${error.message})`);
  }
  return { ...metadata, document: relativePath };
}

export function collectFeatureMetadata() {
  return listFiles('docs/features', (file) => file.endsWith('.md')).map((relativePath) => (
    parseFeatureDocument(read(relativePath), relativePath)
  ));
}

function extractScreens(indexSource) {
  return [...indexSource.matchAll(/\bid="view-([^"]+)"/g)].map((match) => match[1]).filter((value, index, all) => all.indexOf(value) === index).sort();
}

function extractTabs(indexSource) {
  return [...indexSource.matchAll(/\bid="tab-([^"]+)"/g)].map((match) => match[1]).filter((value, index, all) => all.indexOf(value) === index).sort();
}

function extractLegacyScripts(mainSource) {
  return [...mainSource.matchAll(/['"](\/legacy\/js\/[^'"]+\.js)['"]/g)].map((match) => `public${match[1]}`).filter((value, index, all) => all.indexOf(value) === index).sort();
}

function extractLazyDomains(mainSource) {
  const block = mainSource.match(/const LEGACY_DOMAIN_SCRIPTS = \{([\s\S]*?)\n\};/);
  if (!block) return [];
  return [...block[1].matchAll(/^\s{2}([a-z0-9_-]+):\s*\[/gmi)].map((match) => match[1]).sort();
}

function edgeFunctions() {
  const base = path.join(ROOT, 'supabase', 'functions');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(base, entry.name, 'index.ts')))
    .map((entry) => entry.name)
    .sort();
}

function architectureDocuments() {
  return listFiles('docs', (file) => file.endsWith('.md') && !file.startsWith('docs/generated/') && !file.startsWith('docs/features/'));
}

function snapshotFingerprint() {
  const roots = ['src', 'public/legacy', 'tests', 'scripts', 'supabase', 'docs'];
  const allowed = /\.(?:js|mjs|cjs|ts|json|md|sql|toml|ps1|css|html)$/i;
  const files = roots.flatMap((dir) => listFiles(dir, (file) => (
    allowed.test(file) && !file.startsWith('docs/generated/')
  )));
  for (const rootFile of ['package.json', 'package-lock.json', 'index.html', 'vite.config.js', 'vitest.config.js', 'playwright.config.mjs', 'capacitor.config.json', 'netlify.toml']) {
    if (fs.existsSync(path.join(ROOT, rootFile))) files.push(rootFile);
  }
  const hash = createHash('sha256');
  for (const relativePath of [...new Set(files)].sort()) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(ROOT, relativePath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function collectInventory({ generatedAt = new Date().toISOString() } = {}) {
  const packageJson = JSON.parse(read('package.json'));
  const mainSource = read('src/main.js');
  const indexSource = read('index.html');
  const testFiles = listFiles('tests', (file) => /\.(test|spec)\.js$/.test(file));
  const featureMetadata = collectFeatureMetadata().sort((a, b) => a.id.localeCompare(b.id));
  return {
    _generatedWarning: WARNING,
    commit: currentCommit(),
    snapshotFingerprint: snapshotFingerprint(),
    generatedAt,
    package: { name: packageJson.name, version: packageJson.version },
    npmScripts: packageJson.scripts || {},
    screens: extractScreens(indexSource),
    navigationTabs: extractTabs(indexSource),
    referencedLegacyScripts: extractLegacyScripts(mainSource),
    lazyDomains: extractLazyDomains(mainSource),
    coreModules: listFiles('src/core', (file) => file.endsWith('.js')),
    dataModules: listFiles('src/data', (file) => file.endsWith('.js')),
    featureDomains: fs.existsSync(path.join(ROOT, 'src', 'features'))
      ? fs.readdirSync(path.join(ROOT, 'src', 'features'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
      : [],
    featureModules: listFiles('src/features', (file) => file.endsWith('.js')),
    testFiles,
    domainContractTests: testFiles.filter((file) => /Contract\.test\.js$/i.test(file)),
    playwrightTests: testFiles.filter((file) => file.startsWith('tests/e2e/') && file.endsWith('.spec.js')),
    supabaseMigrations: listFiles('supabase/migrations', (file) => file.endsWith('.sql')),
    edgeFunctions: edgeFunctions(),
    android: {
      present: fs.existsSync(path.join(ROOT, 'android')),
      capacitorConfig: fs.existsSync(path.join(ROOT, 'capacitor.config.json')),
      gradleProject: fs.existsSync(path.join(ROOT, 'android', 'build.gradle')) || fs.existsSync(path.join(ROOT, 'android', 'build.gradle.kts')),
    },
    moduleBudgets: {
      checker: fs.existsSync(path.join(ROOT, 'scripts', 'check-module-budgets.mjs')),
      documentation: fs.existsSync(path.join(ROOT, 'docs', 'V11_PERFORMANCE_BUDGETS.md')),
    },
    architectureDocuments: architectureDocuments(),
    criticalFeatures: featureMetadata,
  };
}

function mdList(items) {
  return items.length ? items.map((item) => `- \`${item}\``).join('\n') : '- Aucun élément détecté.';
}

function scriptTable(scripts) {
  return Object.entries(scripts).map(([name, command]) => `| \`${name}\` | \`${String(command).replaceAll('|', '\\|')}\` |`).join('\n');
}

function regressionMatrix(features) {
  const columns = [
    ['wallet', 'Wallet'],
    ['dailyBudget', 'Budget journalier'],
    ['analysis', 'Analyse'],
    ['trip', 'Trip'],
    ['offline', 'Offline'],
    ['android', 'Android'],
  ];
  const symbol = (value) => ({ required: '✓', kpi: 'KPI', possible: 'Possible', none: '—' }[value] || '—');
  const header = `| Fonction critique | ${columns.map(([, label]) => label).join(' | ')} |`;
  const separator = `|---|${columns.map(() => '---').join('|')}|`;
  const rows = features.map((feature) => `| [\`${feature.id}\`](../features/${path.basename(feature.document)}) | ${columns.map(([key]) => symbol(feature.impacts?.[key])).join(' | ')} |`);
  return [header, separator, ...rows].join('\n');
}

export function renderMarkdown(inventory) {
  const counts = {
    screens: inventory.screens.length,
    legacy: inventory.referencedLegacyScripts.length,
    core: inventory.coreModules.length,
    data: inventory.dataModules.length,
    featureModules: inventory.featureModules.length,
    tests: inventory.testFiles.length,
    migrations: inventory.supabaseMigrations.length,
    edge: inventory.edgeFunctions.length,
  };
  return `> ${WARNING}\n> Commit analysé : \`${inventory.commit}\`\n> Empreinte du snapshot : \`${inventory.snapshotFingerprint}\`\n> Généré le : \`${inventory.generatedAt}\`\n\n# Inventaire du projet TravelBudget\n\nCet inventaire décrit uniquement des éléments détectables dans le dépôt. Il n'évalue ni la stabilité fonctionnelle, ni la qualité des tests, ni la complétude d'un domaine. Le commit est la base Git au moment de la génération ; l'empreinte identifie le contenu inventorié, y compris les changements locaux.\n\n## Résumé factuel\n\n| Élément | Valeur |\n|---|---:|\n| Version | \`${inventory.package.version}\` |\n| Écrans déclarés | ${counts.screens} |\n| Scripts legacy référencés | ${counts.legacy} |\n| Modules core | ${counts.core} |\n| Modules data | ${counts.data} |\n| Modules features | ${counts.featureModules} |\n| Fichiers de tests | ${counts.tests} |\n| Migrations Supabase | ${counts.migrations} |\n| Fonctions Edge | ${counts.edge} |\n| Projet Android présent | ${inventory.android.present ? 'Oui' : 'Non'} |\n\n## Scripts npm\n\n| Script | Commande |\n|---|---|\n${scriptTable(inventory.npmScripts)}\n\n## Écrans déclarés dans index.html\n\n${mdList(inventory.screens)}\n\n## Onglets de navigation déclarés\n\n${mdList(inventory.navigationTabs)}\n\n## Domaines legacy chargés à la demande\n\n${mdList(inventory.lazyDomains)}\n\n## Scripts legacy référencés par le chargeur\n\n${mdList(inventory.referencedLegacyScripts)}\n\n## Modules src/core\n\n${mdList(inventory.coreModules)}\n\n## Modules src/data\n\n${mdList(inventory.dataModules)}\n\n## Domaines et modules src/features\n\nDomaines :\n\n${mdList(inventory.featureDomains)}\n\nModules :\n\n${mdList(inventory.featureModules)}\n\n## Tests\n\n### Contrats de domaine et d'interface\n\n${mdList(inventory.domainContractTests)}\n\n### Parcours Playwright\n\n${mdList(inventory.playwrightTests)}\n\n### Tous les fichiers de tests\n\n${mdList(inventory.testFiles)}\n\n## Supabase\n\n### Fonctions Edge\n\n${mdList(inventory.edgeFunctions)}\n\n### Migrations\n\n${mdList(inventory.supabaseMigrations)}\n\n## Android et budgets de modules\n\n- Dossier Android : ${inventory.android.present ? 'présent' : 'absent'}\n- Configuration Capacitor : ${inventory.android.capacitorConfig ? 'présente' : 'absente'}\n- Projet Gradle : ${inventory.android.gradleProject ? 'présent' : 'absent'}\n- Contrôle des budgets de modules : ${inventory.moduleBudgets.checker ? 'présent' : 'absent'}\n- Documentation des budgets : ${inventory.moduleBudgets.documentation ? 'présente' : 'absente'}\n\n## Documents d'architecture et de navigation\n\n${mdList(inventory.architectureDocuments)}\n\n## Matrice d'impact déclarée\n\nCette matrice est générée à partir des impacts validés humainement dans les dix fiches critiques. Le script ne les infère pas depuis le code.\n\n${regressionMatrix(inventory.criticalFeatures)}\n`;
}

export function writeInventory(inventory = collectInventory()) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(path.join(GENERATED_DIR, 'project-inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`);
  fs.writeFileSync(path.join(GENERATED_DIR, 'project-inventory.md'), renderMarkdown(inventory));
  const publicAtlas = {
    _generatedWarning: WARNING,
    version: inventory.package.version,
    commit: inventory.commit,
    generatedAt: inventory.generatedAt,
    counts: {
      screens: inventory.screens.length,
      criticalFeatures: inventory.criticalFeatures.length,
      tests: inventory.testFiles.length,
      migrations: inventory.supabaseMigrations.length,
      featureModules: inventory.featureModules.length,
      coreModules: inventory.coreModules.length,
      dataModules: inventory.dataModules.length,
      edgeFunctions: inventory.edgeFunctions.length,
    },
    domains: inventory.featureDomains,
    criticalFeatures: inventory.criticalFeatures.map((feature) => ({
      id: feature.id,
      impacts: feature.impacts || {},
      document: feature.document,
    })),
  };
  fs.writeFileSync(PUBLIC_ATLAS_PATH, `${JSON.stringify(publicAtlas, null, 2)}\n`);
  return inventory;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const inventory = writeInventory();
  process.stdout.write(`Atlas généré pour TravelBudget ${inventory.package.version} (${inventory.commit.slice(0, 12)}).\n`);
}
