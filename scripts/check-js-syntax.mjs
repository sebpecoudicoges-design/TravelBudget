import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const INCLUDED_DIRS = ['src', 'tests', 'scripts'];
const INCLUDED_ROOT_FILES = ['playwright.config.mjs'];
const INCLUDED_LEGACY_FILES = [
  'public/legacy/js/42_assets_ui.js',
];
const EXTENSIONS = new Set(['.js', '.mjs']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

const files = [
  ...INCLUDED_DIRS.flatMap((dir) => walk(path.join(ROOT, dir))),
  ...INCLUDED_ROOT_FILES.map((file) => path.join(ROOT, file)).filter((file) => fs.existsSync(file)),
  ...INCLUDED_LEGACY_FILES.map((file) => path.join(ROOT, file)).filter((file) => fs.existsSync(file)),
].sort();

const failures = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    failures.push({
      file: path.relative(ROOT, file),
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    });
  }
}

if (failures.length) {
  console.error(`JS syntax check failed for ${failures.length} file(s):`);
  for (const failure of failures) {
    console.error(`\n- ${failure.file}`);
    if (failure.output) console.error(failure.output);
  }
  process.exit(1);
}

console.log(`JS syntax OK: ${files.length} file(s) checked.`);
