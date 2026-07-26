import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const packageData = JSON.parse(await readFile(packagePath, 'utf8'));
const version = String(packageData.version || '').trim();

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Version package.json invalide: ${version || '(vide)'}`);
}

const targets = [
  {
    file: 'index.html',
    pattern: /window\.TB_VERSION = window\.__TB_BUILD = "[^"]+";/,
    replacement: `window.TB_VERSION = window.__TB_BUILD = "${version}";`,
  },
  {
    file: 'public/legacy/js/00_constants.js',
    pattern: /window\.TB_VERSION = window\.TB_VERSION \|\| "[^"]+";/,
    replacement: `window.TB_VERSION = window.TB_VERSION || "${version}";`,
  },
  {
    file: 'public/sw.js',
    pattern: /const TB_SW_VERSION = "travelbudget-pwa-[^"]+";/,
    replacement: `const TB_SW_VERSION = "travelbudget-pwa-${version}";`,
  },
];

let changed = 0;
for (const target of targets) {
  const filePath = path.join(root, target.file);
  const source = await readFile(filePath, 'utf8');
  if (!target.pattern.test(source)) {
    throw new Error(`Marqueur de version introuvable: ${target.file}`);
  }
  const next = source.replace(target.pattern, target.replacement);
  if (next !== source) {
    await writeFile(filePath, next, 'utf8');
    changed += 1;
  }
}

console.log(`Version synchronisée: ${version} (${changed} fichier(s) mis à jour)`);
