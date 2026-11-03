import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const deno = fileURLToPath(new URL('../node_modules/deno/bin.cjs', import.meta.url));
const coreConfig = fileURLToPath(new URL('../config/deno-core-lint.json', import.meta.url));

export function checkCoreSemantics(root = process.cwd()) {
  return checkSemanticSources(root, 'src/core', coreConfig);
}

export function checkSemanticSources(root, directory, config, extensions = ['.js']) {
  const base = path.join(root, directory);
  const files = fs.readdirSync(base, { recursive: true }).filter(file => extensions.includes(path.extname(file))).map(file => path.join(base, file)).sort();
  if (!files.length) throw new Error(`No JavaScript sources found in ${directory}`);
  const result = spawnSync(process.execPath, [deno, 'lint', '--config', config, '--json', ...files], {
    cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024,
  });
  return { files, ok: !result.error && result.status === 0,
    output: [result.error?.message, result.stdout, result.stderr].filter(Boolean).join('\n') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = checkCoreSemantics();
  if (!result.ok) console.error(result.output.trim());
  console.log(`Core semantics ${result.ok ? 'OK' : 'FAILED'}: ${result.files.length} JavaScript source(s).`);
  if (!result.ok) process.exitCode = 1;
}
