import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkSemanticSources } from './check-core-semantics.mjs';

const config = fileURLToPath(new URL('../config/deno-core-lint.json', import.meta.url));
export function checkServerSemantics(root = process.cwd()) {
  const results = ['supabase/functions', 'netlify/functions'].map(directory =>
    checkSemanticSources(root, directory, config, ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx']));
  return { files: results.flatMap(result => result.files), ok: results.every(result => result.ok),
    output: results.filter(result => !result.ok).map(result => result.output).join('\n') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = checkServerSemantics();
  if (!result.ok) console.error(result.output.trim());
  console.log(`Server semantics ${result.ok ? 'OK' : 'FAILED'}: ${result.files.length} JavaScript/TypeScript source(s).`);
  if (!result.ok) process.exitCode = 1;
}
