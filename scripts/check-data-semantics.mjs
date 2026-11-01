import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkSemanticSources } from './check-core-semantics.mjs';

const config = fileURLToPath(new URL('../config/deno-data-lint.json', import.meta.url));
export function checkDataSemantics(root = process.cwd()) {
  return checkSemanticSources(root, 'src/data', config);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = checkDataSemantics();
  if (!result.ok) console.error(result.output.trim());
  console.log(`Data semantics ${result.ok ? 'OK' : 'FAILED'}: ${result.files.length} JavaScript source(s).`);
  if (!result.ok) process.exitCode = 1;
}
