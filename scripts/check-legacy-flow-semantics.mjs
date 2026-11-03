import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkSemanticSources } from './check-core-semantics.mjs';

const config = fileURLToPath(new URL('../config/deno-legacy-flow-lint.json', import.meta.url));
export function checkLegacyFlowSemantics(root = process.cwd()) {
  return checkSemanticSources(root, 'public/legacy/js', config);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = checkLegacyFlowSemantics();
  if (!result.ok) console.error(result.output.trim());
  console.log(`Legacy flow semantics ${result.ok ? 'OK' : 'FAILED'}: ${result.files.length} JavaScript source(s).`);
  if (!result.ok) process.exitCode = 1;
}
