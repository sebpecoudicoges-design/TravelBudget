import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DEFAULT_FILES = ['public/projet.html', 'public/privacy.html'];
const TIMEOUT_MS = Number(process.env.TB_LINK_TIMEOUT_MS || 12000);

const errors = [];
const checked = { local: 0, external: 0, mailto: 0, anchor: 0 };

function fail(message) {
  errors.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function publicPathFromUrl(urlPath) {
  const clean = String(urlPath || '/').split('?')[0].split('#')[0] || '/';
  if (clean === '/') return path.join(ROOT, 'index.html');
  return path.join(PUBLIC_DIR, decodeURIComponent(clean.replace(/^\/+/, '')));
}

function extractIds(source) {
  const ids = new Set();
  for (const match of source.matchAll(/\bid=["']([^"']+)["']/g)) ids.add(match[1]);
  return ids;
}

function extractLinks(source) {
  const links = [];
  const patterns = [
    /\b(?:href|src)=["']([^"']+)["']/g,
    /\bfetch\(["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) links.push(match[1]);
  }
  return [...new Set(links)].filter(Boolean).sort();
}

function localDocumentFor(relativePath, targetPath) {
  if (targetPath.startsWith('/')) return publicPathFromUrl(targetPath);
  return path.resolve(path.dirname(path.join(ROOT, relativePath)), targetPath.split('?')[0].split('#')[0]);
}

function checkLocal(relativePath, target) {
  const [withoutHash, hash = ''] = target.split('#');
  const filePath = localDocumentFor(relativePath, withoutHash || relativePath);
  checked.local += 1;
  if (!fs.existsSync(filePath)) {
    fail(`${relativePath}: lien local absent ${target}`);
    return;
  }
  if (hash) {
    checked.anchor += 1;
    const source = fs.readFileSync(filePath, 'utf8');
    if (!extractIds(source).has(hash)) fail(`${relativePath}: ancre absente ${target}`);
  }
}

async function fetchWithTimeout(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'TravelBudget-link-check/1.0' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkExternal(relativePath, target) {
  checked.external += 1;
  try {
    let response = await fetchWithTimeout(target, 'HEAD');
    if (response.status === 405 || response.status === 403) response = await fetchWithTimeout(target, 'GET');
    if (!response.ok) fail(`${relativePath}: lien public ${target} retourne HTTP ${response.status}`);
  } catch (error) {
    fail(`${relativePath}: lien public ${target} inaccessible (${error.message})`);
  }
}

async function main() {
  const externalChecks = [];
  for (const relativePath of DEFAULT_FILES) {
    const source = read(relativePath);
    const ids = extractIds(source);
    for (const target of extractLinks(source)) {
      if (target.startsWith('mailto:') || target.startsWith('tel:')) {
        checked.mailto += 1;
        continue;
      }
      if (target.startsWith('#')) {
        checked.anchor += 1;
        if (!ids.has(target.slice(1))) fail(`${relativePath}: ancre locale absente ${target}`);
        continue;
      }
      if (/^https?:\/\//i.test(target)) {
        externalChecks.push(checkExternal(relativePath, target));
        continue;
      }
      checkLocal(relativePath, target);
    }
  }
  await Promise.all(externalChecks);
  if (errors.length) {
    process.stderr.write(`Controle des liens publics en echec (${errors.length}):\n- ${errors.join('\n- ')}\n`);
    process.exit(1);
  }
  process.stdout.write(`Liens publics OK: ${checked.local} locaux, ${checked.anchor} ancres, ${checked.external} externes, ${checked.mailto} mailto.\n`);
}

main().catch((error) => {
  process.stderr.write(`Controle des liens publics interrompu: ${error.stack || error.message}\n`);
  process.exit(1);
});
