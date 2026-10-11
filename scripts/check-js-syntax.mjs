import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const INCLUDED_DIRS = ['src', 'tests', 'scripts', 'public', 'netlify'];
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

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

export function collectJavaScriptFiles(root = ROOT) {
  return [
    ...INCLUDED_DIRS.flatMap((dir) => walk(path.join(root, dir))),
    ...fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isFile() && EXTENSIONS.has(path.extname(entry.name)))
      .map((entry) => path.join(root, entry.name)),
  ].sort();
}

export function checkJavaScriptSyntax(root = ROOT) {
  const files = collectJavaScriptFiles(root);
  const failures = [];
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], {
      cwd: root,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      failures.push({
        file: path.relative(root, file),
        output: [result.error?.message, result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
      });
    }
  }
  return { files, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { files, failures } = checkJavaScriptSyntax();
  if (failures.length) {
    console.error(`JS syntax check failed for ${failures.length} file(s):`);
    for (const failure of failures) {
      console.error(`\n- ${failure.file}`);
      if (failure.output) console.error(failure.output);
    }
    process.exit(1);
  }
  console.log(`JS syntax OK: ${files.length} file(s) checked.`);
}
