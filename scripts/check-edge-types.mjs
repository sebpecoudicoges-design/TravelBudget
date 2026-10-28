import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const deno = fileURLToPath(new URL('../node_modules/deno/bin.cjs', import.meta.url));
const lock = fileURLToPath(new URL('../config/edge-check.lock', import.meta.url));

export function collectEdgeTypeScript(root = process.cwd()) {
  const files = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(full);
    }
  };
  walk(path.join(root, 'supabase/functions'));
  if (!files.length) throw new Error('No Edge TypeScript sources found');
  return files.sort();
}

export function checkEdgeTypes(root = process.cwd()) {
  const files = collectEdgeTypeScript(root);
  // Imports are explicit URLs/npm/jsr specifiers. Ignore deployment-specific import maps.
  // check resolves dependencies and checks types; it never starts a function handler.
  const result = spawnSync(process.execPath, [deno, 'check', '--no-config', `--lock=${lock}`, '--frozen=true', ...files], {
    cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024,
  });
  return { files, ok: !result.error && result.status === 0,
    output: [result.error?.message, result.stdout, result.stderr].filter(Boolean).join('\n') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = checkEdgeTypes();
  if (result.output) console.log(result.output.trim());
  console.log(`Edge types ${result.ok ? 'OK' : 'FAILED'}: ${result.files.length} TypeScript source(s).`);
  if (!result.ok) process.exitCode = 1;
}
